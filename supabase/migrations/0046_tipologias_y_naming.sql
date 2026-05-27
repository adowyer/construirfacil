-- =============================================================================
-- ConstruirFácil — Tipologías + naming system
-- Migration: 0046_tipologias_y_naming.sql
-- =============================================================================
-- Sistema de tipologías arquitectónicas (EJE, NODO, ZETA, DECK) que entra al
-- nombre comercial de cada casa. Compañera de la librería de Sistemas
-- Constructivos (0019): mismo patrón shared/owned por marca_id.
--
--   tipologia_catalog
--     marca_id NULL → COMPARTIDO (lo administra CF, cualquier marca lo usa)
--     marca_id = X  → PROPIETARIO de esa marca (override o exclusivo)
--
-- Además:
--   • lineas.concept_blurb     → texto del concepto de la línea (banner ficha)
--   • lineas.naming_strategy   → jsonb {order, suffix_source}
--   • lineas.variante_labels   → jsonb {"0":"Compacta","1":"1 Dormitorio",...}
--   • house_catalog.tipologia_code_new → transicional para el backfill 0047
--   • house_catalog.feature_delta      → "+ baño + lavadero ext." (sub-variantes)
--
-- IDEMPOTENTE. Reads públicos, writes service-role.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- TABLE: tipologia_catalog
-- -----------------------------------------------------------------------------
create table if not exists public.tipologia_catalog (
  id              uuid primary key default gen_random_uuid(),
  marca_id        uuid references public.marcas(id) on delete cascade,
  code            text not null,
  nombre          text not null,
  descripcion     text,
  sort_order      integer not null default 0,
  status          text not null default 'active'
                    check (status in ('active','inactive','archived')),
  updated_at      timestamptz not null default now()
);

comment on table public.tipologia_catalog is
  'Librería de tipologías arquitectónicas (EJE/NODO/ZETA/DECK + extensiones). Compañera de sistema_constructivo_content: marca_id NULL = compartido, marca_id = X = propietario.';
comment on column public.tipologia_catalog.code is
  'Identificador en mayúsculas usado en house_catalog.tipologia_code (ej "EJE"). Entra al display name como "CASA <code> Estilo <ESTILO>".';
comment on column public.tipologia_catalog.descripcion is
  'Texto explicativo del partido arquitectónico, visible en la ficha de la casa.';

-- UNIQUE (marca_id, code) con NULLS NOT DISTINCT: un compartido y un override
-- propietario pueden coexistir con el mismo code (el propietario gana en su
-- marca). Mismo patrón que sistema_constructivo_content.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tipologia_catalog_marca_code_uniq'
      and conrelid = 'public.tipologia_catalog'::regclass
  ) then
    alter table public.tipologia_catalog
      add constraint tipologia_catalog_marca_code_uniq
      unique nulls not distinct (marca_id, code);
  end if;
end$$;

create index if not exists idx_tipologia_catalog_marca  on public.tipologia_catalog (marca_id);
create index if not exists idx_tipologia_catalog_code   on public.tipologia_catalog (code);
create index if not exists idx_tipologia_catalog_status on public.tipologia_catalog (status);

drop trigger if exists tipologia_catalog_updated_at on public.tipologia_catalog;
create trigger tipologia_catalog_updated_at
  before update on public.tipologia_catalog
  for each row execute procedure public.handle_updated_at();

-- RLS: read público, write service-role.
grant select on table public.tipologia_catalog to anon, authenticated;
alter table public.tipologia_catalog enable row level security;
drop policy if exists "tipologia_catalog public read" on public.tipologia_catalog;
create policy "tipologia_catalog public read"
  on public.tipologia_catalog for select using (true);

-- -----------------------------------------------------------------------------
-- Seed: las 4 tipologías compartidas (EJE/NODO/ZETA/DECK) con los textos SH.
-- -----------------------------------------------------------------------------
insert into public.tipologia_catalog (marca_id, code, nombre, descripcion, sort_order)
values
  (null, 'EJE',  'Tipología EJE',
   'Arquitectura diseñada en torno a un eje lateral o central.', 1),
  (null, 'NODO', 'Tipología NODO',
   'Arquitectura diseñada como un ambiente compacto e integrado.', 2),
  (null, 'ZETA', 'Tipología ZETA',
   'Arquitectura diseñada en dos alas con patios interiores.', 3),
  (null, 'DECK', 'Tipología DECK',
   'Arquitectura diseñada en torno a patios centrales o jardines exteriores.', 4)
on conflict (marca_id, code) do nothing;

-- -----------------------------------------------------------------------------
-- lineas: concept_blurb + naming_strategy + variante_labels
-- -----------------------------------------------------------------------------
alter table public.lineas
  add column if not exists concept_blurb    text,
  add column if not exists naming_strategy  jsonb not null default '{"order":"tipologia-first","suffix_source":"tipologia"}'::jsonb,
  add column if not exists variante_labels  jsonb not null default '{}'::jsonb;

comment on column public.lineas.concept_blurb is
  'Texto del concepto de la línea (visible en la ficha de cada casa como banner). Editable en /admin/lineas.';
comment on column public.lineas.naming_strategy is
  'Estrategia de naming: {order:"tipologia-first"|"style-first", suffix_source:"tipologia"|"variante"}. Determina cómo se arma el display name.';
comment on column public.lineas.variante_labels is
  'Mapping variante_code → label visible. Ej Atlas: {"0":"Compacta","1":"1 Dormitorio","2":"2 Dormitorios","3":"3 Dormitorios"}. Bosque: {"1":"1 Planta","2":"2 Plantas"}.';

-- Seed de textos SH y variante_labels iniciales por línea (solo si está vacío).
update public.lineas
   set concept_blurb = coalesce(concept_blurb,
         'Estilos heterogéneos pensados para atender la amplia gama cultural de Argentina.'),
       variante_labels = case
         when variante_labels = '{}'::jsonb then
           '{"0":"Compacta","1":"1 Dormitorio","2":"2 Dormitorios","3":"3 Dormitorios"}'::jsonb
         else variante_labels
       end
 where slug = 'atlas';

update public.lineas
   set concept_blurb = coalesce(concept_blurb,
         'Estilos concretos y funcionales con raíz neuquina, pensados para brindar casas económicas y con identidad.'),
       variante_labels = case
         when variante_labels = '{}'::jsonb then
           '{"0":"Compacta (1 ambiente)","1":"1 Dormitorio","2":"2 Dormitorios","3":"3 Dormitorios"}'::jsonb
         else variante_labels
       end
 where slug = 'terra';

update public.lineas
   set concept_blurb = coalesce(concept_blurb,
         'Una línea con grandes aberturas y diseños de líneas puras, pensada para interactuar con la naturaleza.'),
       variante_labels = case
         when variante_labels = '{}'::jsonb then
           '{"1":"1 Planta","2":"2 Plantas"}'::jsonb
         else variante_labels
       end
 where slug = 'bosque';

-- -----------------------------------------------------------------------------
-- house_catalog: columnas transicionales para el backfill (0047)
-- -----------------------------------------------------------------------------
-- tipologia_code_new: se llena en el backfill con EJE/NODO/ZETA/DECK.
-- Coexiste con tipologia_code (legacy '1','2','3','U','O','Z') hasta que el
-- front consuma la nueva. Después del cutover se renombra a tipologia_code.
alter table public.house_catalog
  add column if not exists tipologia_code_new text,
  add column if not exists feature_delta      varchar(60);

comment on column public.house_catalog.tipologia_code_new is
  'Nueva tipología canónica (EJE/NODO/ZETA/DECK + extensiones). Convive con tipologia_code legacy durante el cutover. Se renombra a tipologia_code una vez que el front consume la nueva.';
comment on column public.house_catalog.feature_delta is
  'Delta de la sub-variante (V*.1, V*.2) respecto a la base. Ej "+ baño", "+ lavadero ext.". NULL para variantes base.';

create index if not exists idx_house_catalog_tipologia_code_new
  on public.house_catalog (tipologia_code_new);

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select code, nombre, left(descripcion, 60) from public.tipologia_catalog
--   where marca_id is null order by sort_order;
--
-- select slug, left(concept_blurb, 60), naming_strategy, variante_labels
--   from public.lineas order by sort_order;
--
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='house_catalog'
--     and column_name in ('tipologia_code_new','feature_delta');
-- =============================================================================

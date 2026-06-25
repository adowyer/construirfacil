-- =============================================================================
-- ConstruirFácil — 4 ejes de tipología en house_catalog + librería tipologia_attrs
-- Migration: 0090_house_catalog_4_ejes.sql
-- =============================================================================
-- Reemplaza el modelo "una sola columna tipologia_code_new" (mezclaba circulación
-- y morfología) por 4 atributos independientes alineados al spec del SH y al
-- contrato de datos de Ximia:
--
--   Eje          Valores                            Qué define
--   ----------   --------------------------------   ----------------
--   Circulación  EJES · NODO                        cómo se mueve
--   Morfología   DECK · CUBO · ZETA                 la forma
--   Acceso       Frontal · Lateral · Flip           por dónde entrás
--   Área Social  Anterior · Posterior · Lateral     dónde vivís
--
-- Fuente: planilla "Hausind Catalog Prices 250626.xlsx" hoja SUPERFICIES COSTOS OK
-- + decisión founder 2026-06-25 (BLOC/BLOCK→CUBO, DECK se queda como DECK).
--
-- IMPORTANTE: tipologia_code_new (legacy, mixed) se MANTIENE — el cutover de la
-- UI a los 4 campos nuevos se hace después de validar el backfill. Una migración
-- posterior la deprecará.
--
-- Librería tipologia_attrs sigue el patrón shared/owned por marca_id de
-- tipologia_catalog (0046) y sistema_constructivo_content (0019):
--   marca_id NULL → COMPARTIDO (lo administra CF, cualquier marca lo usa)
--   marca_id = X  → PROPIETARIO de esa marca (override o exclusivo)
--
-- IDEMPOTENTE. Reads públicos, writes service-role.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. house_catalog: 4 columnas nuevas, nullables (se popula en el backfill)
-- -----------------------------------------------------------------------------
alter table public.house_catalog
  add column if not exists circulacion  text,
  add column if not exists morfologia   text,
  add column if not exists acceso       text,
  add column if not exists area_social  text;

comment on column public.house_catalog.circulacion is
  'Cómo se distribuyen los servicios. Valores: EJES (alineados sobre un eje) | NODO (centralizados). Eje de la taxonomía Hausind 2026-06-25.';
comment on column public.house_catalog.morfologia is
  'Forma del volumen. Valores: DECK (deck/patio exterior) | CUBO (cuadrangular compacto) | ZETA (dos alas con patios interiores).';
comment on column public.house_catalog.acceso is
  'Por dónde se entra. Valores: Frontal | Lateral | Flip (2 accesos espejados).';
comment on column public.house_catalog.area_social is
  'Hacia dónde da el área social. Valores: Anterior (frente) | Posterior (contrafrente) | Lateral.';

create index if not exists idx_house_catalog_circulacion on public.house_catalog (circulacion);
create index if not exists idx_house_catalog_morfologia  on public.house_catalog (morfologia);
create index if not exists idx_house_catalog_acceso      on public.house_catalog (acceso);
create index if not exists idx_house_catalog_area_social on public.house_catalog (area_social);

-- -----------------------------------------------------------------------------
-- 2. TABLE tipologia_attrs (librería por eje)
-- -----------------------------------------------------------------------------
-- Una fila por (eje, valor) compartido o por marca. Es lo que va a leer el
-- admin (CRUD por eje) y lo que va a consumir Ximia para narrar cada atributo
-- de la casa ("EJES = servicios alineados al lateral…").
create table if not exists public.tipologia_attrs (
  id           uuid primary key default gen_random_uuid(),
  marca_id     uuid references public.marcas(id) on delete cascade,
  eje          text not null
                 check (eje in ('circulacion','morfologia','acceso','area_social')),
  valor        text not null,
  nombre       text not null,
  descripcion  text,
  sort_order   integer not null default 0,
  status       text not null default 'active'
                 check (status in ('active','inactive','archived')),
  updated_at   timestamptz not null default now()
);

comment on table public.tipologia_attrs is
  'Librería de los 4 ejes nuevos de tipología (circulación, morfología, acceso, área social). Cada fila = un valor de un eje. Patrón shared/owned: marca_id NULL = compartido, marca_id = X = propietario.';
comment on column public.tipologia_attrs.eje is
  'Cuál de los 4 ejes. Limita el dominio del valor.';
comment on column public.tipologia_attrs.valor is
  'Valor canónico que va en house_catalog.{eje} (ej "EJES", "DECK", "Frontal").';
comment on column public.tipologia_attrs.nombre is
  'Nombre display para UI ("Circulación EJES", "Acceso Flip").';
comment on column public.tipologia_attrs.descripcion is
  'Línea narrativa que consume Ximia + ficha. 1-2 oraciones, no copy de marketing.';

-- UNIQUE (marca_id, eje, valor) con NULLS NOT DISTINCT — mismo patrón que
-- tipologia_catalog (0046): un compartido y un override propietario coexisten.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tipologia_attrs_marca_eje_valor_uniq'
      and conrelid = 'public.tipologia_attrs'::regclass
  ) then
    alter table public.tipologia_attrs
      add constraint tipologia_attrs_marca_eje_valor_uniq
      unique nulls not distinct (marca_id, eje, valor);
  end if;
end$$;

create index if not exists idx_tipologia_attrs_marca  on public.tipologia_attrs (marca_id);
create index if not exists idx_tipologia_attrs_eje    on public.tipologia_attrs (eje);
create index if not exists idx_tipologia_attrs_status on public.tipologia_attrs (status);

drop trigger if exists tipologia_attrs_updated_at on public.tipologia_attrs;
create trigger tipologia_attrs_updated_at
  before update on public.tipologia_attrs
  for each row execute procedure public.handle_updated_at();

-- RLS: read público, write service-role.
grant select on table public.tipologia_attrs to anon, authenticated;
alter table public.tipologia_attrs enable row level security;
drop policy if exists "tipologia_attrs public read" on public.tipologia_attrs;
create policy "tipologia_attrs public read"
  on public.tipologia_attrs for select using (true);

-- -----------------------------------------------------------------------------
-- 3. Seed: 11 valores compartidos (Hausind taxonomía 250626)
-- -----------------------------------------------------------------------------
-- Las descripciones son drafts editoriales: se pulen en /admin/tipologias.
-- El sort_order determina el orden en chips/filtros de catálogo.
insert into public.tipologia_attrs (marca_id, eje, valor, nombre, descripcion, sort_order) values
  -- Circulación
  (null, 'circulacion', 'EJES', 'Circulación EJES',
   'Los servicios se alinean sobre un eje lateral o central, dejando el resto de la casa libre para crecer en torno a él.', 1),
  (null, 'circulacion', 'NODO', 'Circulación NODO',
   'Los servicios se concentran en un núcleo central compacto que organiza la planta entera.', 2),

  -- Morfología
  (null, 'morfologia', 'DECK', 'Morfología DECK',
   'Volumen que se abre a un deck o patio exterior continuo con el living.', 1),
  (null, 'morfologia', 'CUBO', 'Morfología CUBO',
   'Volumen cuadrangular compacto, sin retiros ni patios internos.', 2),
  (null, 'morfologia', 'ZETA', 'Morfología ZETA',
   'Dos alas en planta con patios interiores entre ellas.', 3),

  -- Acceso
  (null, 'acceso', 'Frontal', 'Acceso Frontal',
   'Se ingresa desde el frente del lote.', 1),
  (null, 'acceso', 'Lateral', 'Acceso Lateral',
   'Se ingresa por uno de los laterales del lote.', 2),
  (null, 'acceso', 'Flip', 'Acceso Flip',
   'Dos accesos espejados: la casa se adapta a la orientación del lote.', 3),

  -- Área Social
  (null, 'area_social', 'Anterior', 'Área Social Anterior',
   'El living/comedor da al frente del lote.', 1),
  (null, 'area_social', 'Posterior', 'Área Social Posterior',
   'El living/comedor da al contrafrente.', 2),
  (null, 'area_social', 'Lateral', 'Área Social Lateral',
   'El living/comedor da a uno de los laterales del lote.', 3)
on conflict (marca_id, eje, valor) do nothing;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- 1) Columnas nuevas presentes:
--    select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'house_catalog'
--       and column_name in ('circulacion','morfologia','acceso','area_social')
--     order by column_name;
--    Esperado: 4 filas.
--
-- 2) Librería seedeada:
--    select eje, valor, nombre, left(descripcion, 50) as desc_preview
--      from public.tipologia_attrs
--     where marca_id is null
--     order by eje, sort_order;
--    Esperado: 11 filas (2 + 3 + 3 + 3).
--
-- 3) house_catalog todavía sin backfill (todos NULL, ok):
--    select count(*) filter (where circulacion is null) as null_circ,
--           count(*) filter (where morfologia  is null) as null_morfo,
--           count(*) filter (where acceso      is null) as null_acc,
--           count(*) filter (where area_social is null) as null_social,
--           count(*) as total
--      from public.house_catalog;
-- =============================================================================

-- =============================================================================
-- ConstruirFácil — Ubicación: provincias + reglas zonales por marca
-- Migration: 0047_ubicacion.sql
-- =============================================================================
-- El cliente ELIGE una provincia en los filtros del catálogo. Cada marca
-- define reglas por provincia (excluida, modifier, extra_charge, contact-only,
-- promo). Las reglas se pueden afinar por línea y/o sistema constructivo
-- (ej. "Wood Plus sí, Stone Plus no en Tierra del Fuego").
--
--   marca_zonas:
--     (marca_id, provincia_id, linea_id, sistema_constructivo)
--     PK lógico: UNIQUE NULLS NOT DISTINCT — admite una regla "general"
--     (linea=null, sc=null) más overrides por línea y/o SC.
--
--   extra_charge_amount + extra_charge_label:
--     SOLO en la regla general (linea=null, sc=null). Es un cargo plano por
--     provincia (logística), no varía por modelo/línea/SC. Se enforce vía
--     CHECK constraint (NULL si no es la regla general).
--
--   excluded / contact_only / price_modifier_pct / promo_label / notes:
--     Pueden vivir en cualquier nivel de especificidad. Resolución es
--     most-specific-wins (helper en lib/content/zones.ts).
--
-- IDEMPOTENTE. Reads públicos para provincias y marca_zonas activas.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- TABLE: provincias (catálogo fijo de jurisdicciones de Argentina)
-- -----------------------------------------------------------------------------
create table if not exists public.provincias (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.provincias is
  'Provincias de Argentina + CABA. Lista fija seed; no se administra desde el panel.';

create index if not exists idx_provincias_sort on public.provincias (sort_order);

grant select on table public.provincias to anon, authenticated;
alter table public.provincias enable row level security;
drop policy if exists "provincias public read" on public.provincias;
create policy "provincias public read"
  on public.provincias for select using (true);

-- Seed: 23 provincias + CABA, ordenadas alfabéticamente.
insert into public.provincias (slug, name, sort_order) values
  ('caba',                  'Ciudad Autónoma de Buenos Aires',  1),
  ('buenos-aires',          'Buenos Aires',                      2),
  ('catamarca',             'Catamarca',                         3),
  ('chaco',                 'Chaco',                             4),
  ('chubut',                'Chubut',                            5),
  ('cordoba',               'Córdoba',                           6),
  ('corrientes',            'Corrientes',                        7),
  ('entre-rios',            'Entre Ríos',                        8),
  ('formosa',               'Formosa',                           9),
  ('jujuy',                 'Jujuy',                            10),
  ('la-pampa',              'La Pampa',                         11),
  ('la-rioja',              'La Rioja',                         12),
  ('mendoza',               'Mendoza',                          13),
  ('misiones',              'Misiones',                         14),
  ('neuquen',               'Neuquén',                          15),
  ('rio-negro',             'Río Negro',                        16),
  ('salta',                 'Salta',                            17),
  ('san-juan',              'San Juan',                         18),
  ('san-luis',              'San Luis',                         19),
  ('santa-cruz',            'Santa Cruz',                       20),
  ('santa-fe',              'Santa Fe',                         21),
  ('santiago-del-estero',   'Santiago del Estero',              22),
  ('tierra-del-fuego',      'Tierra del Fuego',                 23),
  ('tucuman',               'Tucumán',                          24)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- TABLE: marca_zonas — reglas zonales por marca
-- -----------------------------------------------------------------------------
create table if not exists public.marca_zonas (
  id                       uuid primary key default gen_random_uuid(),
  marca_id                 uuid not null references public.marcas(id) on delete cascade,
  provincia_id             uuid not null references public.provincias(id) on delete cascade,
  /** NULL = aplica a TODAS las líneas de la marca. */
  linea_id                 uuid references public.lineas(id) on delete cascade,
  /** NULL = aplica a TODOS los SCs. Texto libre (igual que house_catalog.sistema_constructivo). */
  sistema_constructivo     text,

  /** No se vende ahí. Soft block: la card aparece con badge "consultar". */
  excluded                 boolean not null default false,
  /** % aplicado a los 3 precios. 10.00 = +10%, -5.00 = -5%. */
  price_modifier_pct       numeric(5, 2),
  /** Cargo plano sumado al precio (USD). SOLO regla general (linea=null, sc=null). */
  extra_charge_amount      numeric(12, 2),
  /** Label admin del extra_charge (ej. "Transporte Patagonia"). No se muestra al cliente. */
  extra_charge_label       text,
  /** No cotiza por website; muestra "Consultar precio" y derivamos a lead form. */
  contact_only             boolean not null default false,
  /** Texto opcional para badge promo (ej. "Envío bonificado"). */
  promo_label              text,
  /** Notas internas (no se muestran). */
  notes                    text,

  status                   text not null default 'active'
                             check (status in ('active','inactive','archived')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- CHECK: extra_charge_amount solo es válido en la regla general. Si la
  -- regla tiene linea_id o sc, el cargo debe ser NULL.
  constraint marca_zonas_extra_charge_general_only check (
    extra_charge_amount is null
    or (linea_id is null and sistema_constructivo is null)
  )
);

comment on table public.marca_zonas is
  'Reglas zonales por marca. UNIQUE (marca, provincia, linea, sc) NULLS NOT DISTINCT permite reglas generales y overrides finos.';
comment on column public.marca_zonas.linea_id is
  'NULL = aplica a todas las líneas de la marca. Override por línea = setear linea_id.';
comment on column public.marca_zonas.sistema_constructivo is
  'NULL = aplica a todos los SCs. Texto libre (matchea house_catalog.sistema_constructivo).';
comment on column public.marca_zonas.extra_charge_amount is
  'Cargo plano por (marca, provincia) sumado al precio mostrado. Solo en regla general (linea=null, sc=null).';

-- UNIQUE (marca, provincia, linea, sc) con NULLS NOT DISTINCT
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marca_zonas_scope_uniq'
      and conrelid = 'public.marca_zonas'::regclass
  ) then
    alter table public.marca_zonas
      add constraint marca_zonas_scope_uniq
      unique nulls not distinct (marca_id, provincia_id, linea_id, sistema_constructivo);
  end if;
end$$;

create index if not exists idx_marca_zonas_marca       on public.marca_zonas (marca_id);
create index if not exists idx_marca_zonas_provincia   on public.marca_zonas (provincia_id);
create index if not exists idx_marca_zonas_status      on public.marca_zonas (status);

drop trigger if exists marca_zonas_updated_at on public.marca_zonas;
create trigger marca_zonas_updated_at
  before update on public.marca_zonas
  for each row execute procedure public.handle_updated_at();

grant select on table public.marca_zonas to anon, authenticated;
alter table public.marca_zonas enable row level security;
drop policy if exists "marca_zonas public read" on public.marca_zonas;
create policy "marca_zonas public read"
  on public.marca_zonas for select using (status = 'active');

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select count(*) from public.provincias;
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='marca_zonas';
-- =============================================================================

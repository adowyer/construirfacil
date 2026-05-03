-- =============================================================================
-- ConstruirFácil — Tablas de contenido editorial (brand / line / model)
-- Migration: 0005_content_tables.sql
-- =============================================================================
-- Estas tablas YA existen en Supabase desde antes que el repo trackeara
-- migraciones. Esta migración es idempotente y registra el schema canónico
-- para el repo, asegurando además los UNIQUE constraints que las server
-- actions usan para hacer upsert.
--
-- Tablas:
--   brand_content  — textos globales de marca (sliders educativos, valores).
--   line_content   — textos por línea (ATLAS/BOSQUE/TERRA), opcional por tipología.
--   model_content  — textos editoriales por modelo. Consumido por Ximia (IA).
--
-- Convención: line_content.linea y model_content.linea guardan el `name` de
-- la línea (ej. "ATLAS"), no el slug. El trigger sync_house_catalog_denorm
-- ya escribe `name` en `house_catalog.linea`, así que el join es consistente.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- updated_at helper (declared en 0001 ya, no lo redefinimos)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- TABLE: brand_content
-- -----------------------------------------------------------------------------
create table if not exists public.brand_content (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  title       text,
  subtitle    text,
  body        text,
  cta_label   text,
  cta_url     text,
  sort_order  integer not null default 0,
  status      text not null default 'active'
                check (status in ('active','inactive','archived')),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_brand_content_status on public.brand_content (status);
create index if not exists idx_brand_content_sort   on public.brand_content (sort_order);

drop trigger if exists brand_content_updated_at on public.brand_content;
create trigger brand_content_updated_at
  before update on public.brand_content
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- TABLE: line_content
-- -----------------------------------------------------------------------------
create table if not exists public.line_content (
  id              uuid primary key default gen_random_uuid(),
  linea           text not null,
  tipologia_code  text,
  title           text,
  subtitle        text,
  body            text,
  sort_order      integer not null default 0,
  status          text not null default 'active'
                    check (status in ('active','inactive','archived')),
  updated_at      timestamptz not null default now()
);

-- UNIQUE (linea, tipologia_code) tratando NULL como valor distinguible.
-- Postgres 15+ soporta NULLS NOT DISTINCT (Supabase corre PG15+).
-- Nombre fijo para que sea idempotente (drop+create si ya existe).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'line_content_linea_tipologia_uniq'
      and conrelid = 'public.line_content'::regclass
  ) then
    alter table public.line_content
      add constraint line_content_linea_tipologia_uniq
      unique nulls not distinct (linea, tipologia_code);
  end if;
end$$;

create index if not exists idx_line_content_linea  on public.line_content (linea);
create index if not exists idx_line_content_status on public.line_content (status);
create index if not exists idx_line_content_sort   on public.line_content (sort_order);

drop trigger if exists line_content_updated_at on public.line_content;
create trigger line_content_updated_at
  before update on public.line_content
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- TABLE: model_content
-- -----------------------------------------------------------------------------
create table if not exists public.model_content (
  id                uuid primary key default gen_random_uuid(),
  style_name        text not null,
  linea             text not null,
  tagline           text,
  body              text,
  estilo_label      text,
  lifestyle_tags    text[],
  recommended_use   text,
  family_size_min   integer,
  family_size_max   integer,
  agent_notes       text,
  updated_at        timestamptz not null default now(),
  unique (style_name, linea)
);

create index if not exists idx_model_content_linea       on public.model_content (linea);
create index if not exists idx_model_content_style_linea on public.model_content (style_name, linea);

drop trigger if exists model_content_updated_at on public.model_content;
create trigger model_content_updated_at
  before update on public.model_content
  for each row execute procedure public.handle_updated_at();

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select tablename from pg_tables
--  where schemaname = 'public'
--    and tablename in ('brand_content','line_content','model_content');
--
-- select conname from pg_constraint
--  where conrelid = 'public.line_content'::regclass
--    and contype = 'u';
-- =============================================================================

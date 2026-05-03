-- =============================================================================
-- ConstruirFácil — house_catalog_attributes (tabla join)
-- Migration: 0006_house_catalog_attributes.sql
-- =============================================================================
-- Relación N:M entre `house_catalog` (entrada del catálogo nuevo) y
-- `attribute_values` (taxonomía de atributos: type → value).
--
-- Análoga a la tabla vieja `house_model_attributes` (que apunta a
-- `house_models`), pero para el schema canónico nuevo.
--
-- Idempotente.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- TABLE: house_catalog_attributes
-- -----------------------------------------------------------------------------
create table if not exists public.house_catalog_attributes (
  id                  uuid primary key default gen_random_uuid(),
  house_catalog_id    uuid not null references public.house_catalog(id) on delete cascade,
  attribute_value_id  uuid not null references public.attribute_values(id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (house_catalog_id, attribute_value_id)
);

comment on table public.house_catalog_attributes is
  'Atributos asignados a una entrada del house_catalog (ej: "amenities: piscina"). N:M.';

create index if not exists idx_hca_house_catalog on public.house_catalog_attributes (house_catalog_id);
create index if not exists idx_hca_value         on public.house_catalog_attributes (attribute_value_id);

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select tablename from pg_tables
--  where schemaname = 'public' and tablename = 'house_catalog_attributes';
--
-- select conname from pg_constraint
--  where conrelid = 'public.house_catalog_attributes'::regclass
--    and contype = 'u';
-- =============================================================================

-- =============================================================================
-- ConstruirFácil — UNIQUE(attribute_type_id, slug) en attribute_values
-- Migration: 0007_attribute_values_unique.sql
-- =============================================================================
-- Necesario para hacer upsert idempotente desde 03_import_attributes.mjs
-- (CSV de WordPress).
--
-- NOTA: el schema real de attribute_values en Supabase difiere del 0001 local.
-- Usa columnas: id, attribute_type_id, name, slug, description, sort_order,
-- pending_review, created_by, created_at, updated_at.
-- Por eso el unique va sobre `slug` (no `label`).
-- =============================================================================

begin;

do $$
begin
  -- Saltea si ya existe cualquier UNIQUE sobre (attribute_type_id, slug)
  -- (independiente del nombre del constraint).
  if not exists (
    select 1
      from pg_constraint c
      join pg_attribute a1 on a1.attrelid = c.conrelid and a1.attnum = c.conkey[1]
      join pg_attribute a2 on a2.attrelid = c.conrelid and a2.attnum = c.conkey[2]
     where c.conrelid = 'public.attribute_values'::regclass
       and c.contype  = 'u'
       and array_length(c.conkey, 1) = 2
       and (
         (a1.attname = 'attribute_type_id' and a2.attname = 'slug') or
         (a1.attname = 'slug' and a2.attname = 'attribute_type_id')
       )
  ) then
    alter table public.attribute_values
      add constraint attribute_values_type_slug_uniq
      unique (attribute_type_id, slug);
  end if;
end$$;

commit;

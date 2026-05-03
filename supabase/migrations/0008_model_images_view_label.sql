-- =============================================================================
-- ConstruirFácil — view_label en model_images
-- Migration: 0008_model_images_view_label.sql
-- =============================================================================
-- Agrega una etiqueta legible (ej: "Frente", "Living", "Cocina") que se
-- muestra como pill encima de las galerías exteriores/interiores en la
-- vista expandida del catálogo público.
--
-- Es opcional. Si está NULL, la UI muestra "Foto N" como fallback.
-- =============================================================================

begin;

alter table public.model_images
  add column if not exists view_label text null;

comment on column public.model_images.view_label is
  'Etiqueta legible para la pill en la galería del expandido (Frente/Living/Cocina/etc).';

create index if not exists idx_model_images_view_label
  on public.model_images (view_label)
  where view_label is not null;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'model_images'
--    and column_name = 'view_label';
-- =============================================================================

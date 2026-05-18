-- =============================================================================
-- ConstruirFácil — header_slide_content.admin_label
-- Migration: 0034_header_admin_label.sql
-- =============================================================================
-- Nombre INTERNO del slide, solo para el admin/portal (listas + título del
-- editor). NO se muestra en el catálogo. Permite distinguir slides repetibles
-- (banners / cards de línea) con nombres reconocibles: "Banner Uno",
-- "Campaña Neuquén", etc. Independiente del `title` público.
--
-- ADITIVA: columna nullable. Vacío → el admin cae al título público / label
-- del tipo (cero regresión). Idempotente. La tabla ya tiene policy de
-- lectura (0030); no se toca RLS.
-- =============================================================================

alter table public.header_slide_content
  add column if not exists admin_label text;

comment on column public.header_slide_content.admin_label is
  'Nombre interno del slide (solo admin/portal, no se renderiza en el catálogo). Vacío → se usa el título público o el label del tipo.';

-- =============================================================================
-- select column_name from information_schema.columns
--  where table_name='header_slide_content' and column_name='admin_label';
-- =============================================================================

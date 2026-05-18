-- =============================================================================
-- ConstruirFácil — home_slide_content.admin_label
-- Migration: 0035_home_admin_label.sql
-- =============================================================================
-- Igual que 0034 pero para el HomeRow (slider inferior). Nombre INTERNO del
-- slide, solo para admin/portal (listas + título del editor). NO se renderiza
-- en el catálogo. Sirve para distinguir banners repetibles del HomeRow:
-- "Banner Uno", "Campaña Neuquén", etc. Independiente del `label` público.
--
-- ADITIVA: columna nullable. Vacío → el admin cae al label público / nombre
-- del slot (cero regresión). Idempotente. La tabla ya trae RLS+policy desde
-- 0031; no se toca RLS.
-- =============================================================================

alter table public.home_slide_content
  add column if not exists admin_label text;

comment on column public.home_slide_content.admin_label is
  'Nombre interno del slide (solo admin/portal, no se renderiza en el catálogo). Vacío → se usa el label público o el nombre del slot.';

-- =============================================================================
-- select column_name from information_schema.columns
--  where table_name='home_slide_content' and column_name='admin_label';
-- =============================================================================

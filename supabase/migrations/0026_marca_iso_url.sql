-- =============================================================================
-- ConstruirFácil — marcas.iso_url (isotipo, separado del isologo)
-- Migration: 0026_marca_iso_url.sql
-- =============================================================================
-- `logo_url`  = ISOLOGO  (lockup: símbolo + texto). NO se toca; sigue igual
--               y se renderiza donde ya se renderizaba.
-- `iso_url`   = ISOTIPO  (solo el símbolo). Activo nuevo, independiente.
--
-- ADITIVA Y SIN REGRESIÓN: columna nullable, sin default. Las marcas sin
-- isotipo cargado quedan con iso_url NULL. Dónde se muestra cada uno es una
-- decisión de display aparte — esta migración solo agrega el CRUD del dato.
--
-- Reusa el bucket existente `marca-logos` (0004): el isotipo se sube bajo
-- `{marcaId}/iso/...` para no colisionar con el isologo (`{marcaId}/...`).
--
-- Statement único e idempotente (add column if not exists). Se puede
-- re-correr y pegar entero sin romper.
-- =============================================================================

alter table public.marcas
  add column if not exists iso_url text;

comment on column public.marcas.iso_url is
  'Isotipo (solo símbolo). Separado de logo_url (isologo = símbolo + texto). Activos independientes.';

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte, después)
-- =============================================================================
-- select column_name
--   from information_schema.columns
--  where table_schema='public' and table_name='marcas'
--    and column_name in ('logo_url','iso_url');
-- =============================================================================

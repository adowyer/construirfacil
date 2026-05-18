-- =============================================================================
-- ConstruirFácil — header_slide_content.panel_image_url
-- Migration: 0033_header_panel_image.sql
-- =============================================================================
-- El iso/logo de la COLUMNA DE COLOR de los slides split (crece "La Casa que
-- Crece" y flex "Flex Build Suit"). Hoy hardcodeado (/la-casa-que-crece.png,
-- /Flex-Build-Suit.png — isos de Hausind). Se vuelve editable por CF y por
-- las marcas (portal). `image_url` sigue siendo el FONDO; este es el iso.
--
-- ADITIVA: columna nullable. Sin fila/vacío → el slide usa el iso por
-- defecto (cero regresión). Idempotente. La tabla ya tiene policy de
-- lectura (0030); no se toca RLS.
-- =============================================================================

alter table public.header_slide_content
  add column if not exists panel_image_url text;

comment on column public.header_slide_content.panel_image_url is
  'Iso de la columna de color (crece/flex). Distinto de image_url (fondo). Vacío → iso por defecto hardcoded.';

-- =============================================================================
-- select column_name from information_schema.columns
--  where table_name='header_slide_content' and column_name='panel_image_url';
-- =============================================================================

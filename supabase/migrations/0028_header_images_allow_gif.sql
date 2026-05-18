-- =============================================================================
-- ConstruirFácil — bucket header-images: permitir GIF
-- Migration: 0028_header_images_allow_gif.sql
-- =============================================================================
-- El fondo del slide "casa que crece" pasa a ser una imagen/GIF editable
-- (reemplaza el cross-fade que venía del catálogo). Sumamos image/gif a los
-- mime types permitidos del bucket. Idempotente (set absoluto del array).
-- =============================================================================

update storage.buckets
   set allowed_mime_types = array[
         'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'
       ]
 where id = 'header-images';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- select id, allowed_mime_types from storage.buckets where id = 'header-images';
-- =============================================================================

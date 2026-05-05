-- =============================================================================
-- ConstruirFácil — Storage bucket house-photos: subir límite + permitir PDFs
-- Migration: 0011_house_photos_bucket_config.sql
-- =============================================================================
-- El bucket `house-photos` (creado fuera del repo, fuera de migraciones) tenía
-- `file_size_limit` y `allowed_mime_types` muy restrictivos:
--   - Algunas PNG raster de interior pesan ≥ el límite anterior → upload falla.
--   - PDFs de planos arquitectónicos no estaban en allowed_mime_types.
--
-- Esta migración relaja ambos para que el sync (04_sync_drive_photos.mjs)
-- pueda subir todo el catálogo reorganizado del Drive sin filtrar por tamaño
-- ni por extensión.
--
-- Idempotente.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'house-photos',
  'house-photos',
  true,
  52428800,  -- 50 MB (era ~5 MB)
  array[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'house-photos';
-- =============================================================================

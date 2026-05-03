-- =============================================================================
-- ConstruirFácil — Storage bucket: marca-logos
-- Migration: 0004_marca_logos_bucket.sql
-- =============================================================================
-- Bucket público para los logos de cada marca.
-- Idempotente: se puede correr múltiples veces.
--
-- Path convention (controlado server-side por uploadMarcaLogo):
--   marca-logos/{marca_id}/{timestamp}-{filename}
--
-- Reads: público (cualquiera con la URL puede ver el logo).
-- Writes: solo service-role (vía admin actions). No exponemos policies de
-- INSERT/UPDATE/DELETE a usuarios anónimos/autenticados.
-- =============================================================================

begin;

-- 1. Bucket público
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marca-logos',
  'marca-logos',
  true,
  2097152,  -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Read policy: público
drop policy if exists "marca-logos: public read" on storage.objects;
create policy "marca-logos: public read"
  on storage.objects for select
  using (bucket_id = 'marca-logos');

-- (sin policies de INSERT/UPDATE/DELETE — solo service-role escribe)

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'marca-logos';
-- =============================================================================

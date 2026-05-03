-- =============================================================================
-- ConstruirFácil — Ícono representativo por línea
-- Migration: 0009_lineas_icons.sql
-- =============================================================================
-- Agrega `icon_url` a `lineas` y crea el bucket `linea-icons` para que cada
-- línea tenga un ícono pequeño (estilo BIG.dk) que el catálogo público muestra
-- arriba de la ficha colapsada. Idempotente.
--
-- Path convention (controlado server-side por uploadLineaIcon):
--   linea-icons/{linea_id}/{timestamp}-{filename}
--
-- Reads: público. Writes: solo service-role (vía admin actions).
-- =============================================================================

begin;

-- 1. Columna icon_url
alter table public.lineas
  add column if not exists icon_url text;

comment on column public.lineas.icon_url is
  'URL pública del ícono de la línea (subido al bucket linea-icons). Ideal: SVG monocromo cuadrado.';

-- 2. Bucket público
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'linea-icons',
  'linea-icons',
  true,
  204800, -- 200 KB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Read policy: público
drop policy if exists "linea-icons: public read" on storage.objects;
create policy "linea-icons: public read"
  on storage.objects for select
  using (bucket_id = 'linea-icons');

-- (sin policies de INSERT/UPDATE/DELETE — solo service-role escribe)

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'lineas' and column_name = 'icon_url';
--
-- select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'linea-icons';
-- =============================================================================

-- 0018_model_images_optimized.sql
--
-- Agrega columnas para versiones optimizadas de cada imagen:
--   - thumb_url: WebP ~400px wide. Para cards/listados. ~30-50 KB.
--   - webp_url:  WebP ~1920px max. Para galerías/expandido. ~150-300 KB.
--
-- La columna `storage_url` original queda intacta como fallback.
--
-- El script `scripts/optimize-images.mjs` itera todas las filas, genera
-- las versiones optimizadas, las sube al mismo bucket y popula estas
-- columnas. Es idempotente: filas con ambas columnas pobladas se saltean.

alter table public.model_images
  add column if not exists thumb_url text,
  add column if not exists webp_url text;

-- Index parcial para que las queries que filtran por imágenes
-- optimizadas sean rápidas.
create index if not exists idx_model_images_thumb_url
  on public.model_images (id)
  where thumb_url is not null and webp_url is not null;

comment on column public.model_images.thumb_url is
  'URL pública del thumbnail WebP (~400px wide) — para cards/listados.';
comment on column public.model_images.webp_url is
  'URL pública del WebP optimizado (~1920px max) — para galerías/expandido.';

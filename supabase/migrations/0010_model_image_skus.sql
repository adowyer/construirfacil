-- =============================================================================
-- ConstruirFácil — model_image_skus (tabla join imagen ↔ SKU)
-- Migration: 0010_model_image_skus.sql
-- =============================================================================
-- Relación N:M entre `model_images` y `house_catalog`. Reemplaza el modelo
-- viejo "una foto se asocia a un solo SKU vía columnas denormalizadas
-- (style_name, variante, linea, tipologia_code)" por una join explícita.
--
-- Motivación: con la convención nueva de filenames (`01 Frente V2-3-4.png`),
-- una sola foto física puede aplicar a múltiples SKUs simultáneamente.
-- Las columnas denormalizadas en model_images NO pueden representar eso.
--
-- Reglas que aplica el sync (04_sync_drive_photos.mjs) para popular esta tabla:
--   • Foto en `Renders/EXTERIORES|INTERIORES/Casa X/<file>` con tag V<lista>
--       → linkea a SKUs cuyo style_name = X y variante ∈ <lista>.
--   • Foto en `Renders/EXTERIORES|INTERIORES/Casa X/<file>` SIN tag V
--       → linkea a TODOS los SKUs cuyo style_name = X.
--   • Foto en `Renders/INTERIORES/<file>` (sin subcarpeta Casa X — caso BOSQUE)
--       → linkea a TODOS los SKUs de la tipología (todas las casas × todas
--         las variantes que matcheen el tag V, o todas si no hay tag).
--   • Axonometrías y planos: mismo criterio, scoped por tipología.
--
-- Idempotente.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- TABLE: model_image_skus
-- -----------------------------------------------------------------------------
create table if not exists public.model_image_skus (
  id                uuid primary key default gen_random_uuid(),
  image_id          uuid not null references public.model_images(id)  on delete cascade,
  house_catalog_id  uuid not null references public.house_catalog(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (image_id, house_catalog_id)
);

comment on table public.model_image_skus is
  'Relación N:M entre model_images y house_catalog. Una imagen puede aplicar a múltiples SKUs (ej. tag V2-3-4 → 3 SKUs). Populada por 04_sync_drive_photos.mjs.';
comment on column public.model_image_skus.image_id is
  'FK a model_images. ON DELETE CASCADE: si la foto se borra del Drive y el sync la archiva, los links desaparecen.';
comment on column public.model_image_skus.house_catalog_id is
  'FK a house_catalog (un SKU específico, identificado por la tupla style_name + variante).';

create index if not exists idx_mis_image on public.model_image_skus (image_id);
create index if not exists idx_mis_sku   on public.model_image_skus (house_catalog_id);

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select tablename from pg_tables
--  where schemaname = 'public' and tablename = 'model_image_skus';
--
-- select conname, contype from pg_constraint
--  where conrelid = 'public.model_image_skus'::regclass
--  order by contype, conname;
--
-- select indexname from pg_indexes
--  where schemaname = 'public' and tablename = 'model_image_skus';
-- =============================================================================

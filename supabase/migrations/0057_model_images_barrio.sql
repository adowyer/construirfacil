-- =============================================================================
-- ConstruirFácil — fotos del BARRIO por línea (image_type='barrio')
-- Migration: 0057_model_images_barrio.sql
-- =============================================================================
-- Las fotos del barrio (vías, cartel, equipamiento, vistas comunes del lote)
-- aplican a TODOS los modelos de una línea — no son específicas de un modelo
-- ni de una tipología. Por eso necesitan:
--
--   1. Un nuevo `image_type='barrio'` (hoy: render/plano/axo).
--   2. `tipologia_code` NULLABLE — barrio NO tiene tipología asociada.
--
-- El sync (04_sync_drive_photos.mjs) las recoge desde las carpetas
-- `BARRIO TERRA/`, `BARRIO ATLAS/`, `BARRIO BOSQUE/` (al mismo nivel que
-- `LINEA TERRA/...`) y las linkea en `model_image_skus` a TODOS los SKUs
-- de la línea correspondiente.
--
-- El catálogo (PanelExteriores) las muestra en el slider de Exteriores
-- detrás de un pill 'Barrio' (sub-modo). Filtro:
--   • Casa  → image_type='render' && is_exterior=true
--   • Barrio → image_type='barrio'
--
-- IDEMPOTENTE.
-- =============================================================================

begin;

-- 1) Constraint check del image_type: incluir 'barrio'.
alter table public.model_images
  drop constraint if exists model_images_image_type_check;

alter table public.model_images
  add constraint model_images_image_type_check
  check (image_type in ('render', 'plano', 'axo', 'barrio'));

-- 2) tipologia_code nullable — fotos de barrio NO tienen tipología.
--    Si ya es nullable, no-op (PostgreSQL no se queja).
alter table public.model_images
  alter column tipologia_code drop not null;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select image_type, count(*) from model_images group by image_type;
--   Esperado tras correr el sync con BARRIO <X>/ pobladas:
--     render | ~310
--     plano  | ~15
--     axo    | ~30
--     barrio | N (N = fotos en las 3 carpetas BARRIO)
-- =============================================================================

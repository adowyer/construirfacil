-- =============================================================================
-- ConstruirFácil — separar image_type 'axo' de 'plano'
-- Migration: 0013_split_axo_from_plano.sql
-- =============================================================================
-- El sync 04_sync_drive_photos.mjs etiqueta TANTO axonometrías como planos
-- arquitectónicos como `image_type='plano'`. Vamos a separarlos para que el
-- frontend pueda mostrarlos en slides distintos.
--
-- Reglas:
--   - drive_path contiene "axonometrias" / "axonometricas" / "axo"  → 'axo'
--   - drive_path contiene "planos" / "planta"                        → 'plano' (queda igual)
--
-- Idempotente: solo updatea filas que cambian.
-- =============================================================================

begin;

-- 1) El check constraint actual (`model_images_image_type_check`) acepta solo
--    'render' y 'plano'. Lo dropeamos y recreamos incluyendo 'axo'.
alter table public.model_images
  drop constraint if exists model_images_image_type_check;

alter table public.model_images
  add constraint model_images_image_type_check
  check (image_type in ('render', 'plano', 'axo'));

-- 2) UPDATE: separar axonometrías del bucket genérico 'plano'.
update public.model_images
set image_type = 'axo'
where image_type = 'plano'
  and drive_path ~* '(^|/)axonometr|(^|/)axo[/_]';

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select image_type, count(*) from model_images group by image_type;
--   Esperado:  render | ~310
--              plano  | ~15  (planos arquitectónicos PDF)
--              axo    | ~30  (axonometrías PNG)
-- =============================================================================

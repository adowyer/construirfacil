-- =============================================================================
-- ConstruirFácil — RLS policy: lectura pública de model_image_skus
-- Migration: 0012_model_image_skus_rls.sql
-- =============================================================================
-- La tabla `model_image_skus` (creada por 0010) quedó con RLS habilitado pero
-- sin policies. Resultado: el rol `anon` (catálogo público) recibe 0 filas
-- al hacer el embed `links:model_image_skus(house_catalog_id)` desde
-- `getAllCatalogImages`, lo que hace que ningún filtro del catálogo
-- matchee imágenes (panels muestran "Sin exteriores cargados").
--
-- Esta tabla solo contiene pares de UUIDs (image_id, house_catalog_id) — no
-- expone datos sensibles. Lectura pública es seguro y consistente con cómo
-- funcionan model_images y house_catalog en producción.
--
-- Las escrituras siguen restringidas a service-role (sync + admin actions),
-- así que no hace falta agregar policies de INSERT/UPDATE/DELETE.
--
-- Idempotente.
-- =============================================================================

begin;

alter table public.model_image_skus enable row level security;

drop policy if exists "model_image_skus: public read" on public.model_image_skus;
create policy "model_image_skus: public read"
  on public.model_image_skus for select
  using (true);

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select polname, polcmd, polroles, pg_get_expr(polqual, polrelid) as using_expr
--   from pg_policy
--  where polrelid = 'public.model_image_skus'::regclass;
--
-- Después de aplicar, recargar `/` en producción: las galerías de Exteriores
-- e Interiores deben mostrar fotos de nuevo.
-- =============================================================================

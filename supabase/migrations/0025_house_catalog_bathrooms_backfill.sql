-- =============================================================================
-- ConstruirFácil — Backfill de house_catalog.bathrooms (27 SKU)
-- Migration: 0025_house_catalog_bathrooms_backfill.sql
-- =============================================================================
-- CAUSA RAÍZ: el importador 02_import_models.mjs:271 hacía toNumber(row[12])
--   sobre la col "Baños" del Excel fuente (data/Cost_Models_Catalog_HAUSIND-
--   27-04.xlsx, hoja "SUPERFICIES COSTOS OK", idx 12). toNumber no parsea
--   "1/1" / "3/1" / "2/3" ni celdas que Excel corrompió a Date → 27 SKUs
--   quedaron con bathrooms NULL. Valores recuperados de la planilla:
--     - "a/b"  → primer entero (HB-…-151 → 1, …-243 → 3, …-298 → 3).
--     - Date corrupta (LANCASTER/PATAGONIA) → 1, inferido con certeza por
--       cruce contra estilos hermanos limpios (CALIFORNIA/ESCANDINAVIA/PAMPA).
--
-- INDEPENDIENTE de 0023/0024: keyea por `sku` (clave única / onConflict del
--   import). 0023 normaliza linea/style_name TEXT pero NO toca la columna
--   `sku` → este backfill da el mismo resultado en cualquier orden.
--
-- IDEMPOTENTE: solo escribe donde bathrooms IS NULL → re-correr no pisa
--   correcciones manuales posteriores. Transacción única.
-- =============================================================================

begin;

update public.house_catalog as h
set bathrooms = v.bathrooms
from (values
  ('HB-T1-V2-CEDRO-WP-220', 2),
  ('HB-T2-V2-INGA-WP-220', 2),
  ('HB-T3-V2-ANCHICO-WP-220', 2),
  ('HB-T1-V1-AMBAY-SP-151', 1),
  ('HB-T1-V2-AMBAY-SP-243', 3),
  ('HB-T2-V1-LAPACHO-SP-151', 1),
  ('HB-T2-V2-LAPACHO-SP-243', 3),
  ('HB-T3-V1-CAMBOATA-SP-151', 1),
  ('HB-T3-V2-CAMBOATA-SP-243', 3),
  ('HB-T1-V1-ALECRIN-SP-162', 1),
  ('HB-T1-V2-ALECRIN-SP-298', 3),
  ('HB-T2-V1-GUAYUBIRA-SP-162', 1),
  ('HB-T2-V2-GUAYUBIRA-SP-298', 3),
  ('HB-T3-V1-TIMBO-SP-162', 1),
  ('HB-T3-V2-TIMBO-SP-298', 3),
  ('HB-T1-V1-CEDRO-SP-127', 1),
  ('HB-T1-V2-CEDRO-SP-220', 2),
  ('HB-T2-V1-INGA-SP-127', 1),
  ('HB-T2-V2-INGA-SP-220', 2),
  ('HB-T3-V1-ANCHICO-SP-127', 1),
  ('HB-T3-V2-ANCHICO-SP-220', 2),
  ('HA-T1-V3-LANCASTER-WP-082', 1),
  ('HA-T1-V0-PATAGONIA-WP-040', 1),
  ('HA-T1-V2-PATAGONIA-WP-074', 1),
  ('HA-T1-V3-LANCASTER-SP-082', 1),
  ('HA-T1-V0-PATAGONIA-SP-040', 1),
  ('HA-T1-V2-PATAGONIA-SP-074', 1)
) as v(sku, bathrooms)
where h.sku = v.sku
  and h.bathrooms is null;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte) — debe dar 0:
--   select count(*) from public.house_catalog where bathrooms is null;
-- Detalle de los 27:
--   select sku, style_name, tipologia_code, variante, bathrooms
--     from public.house_catalog
--    where sku in ('HB-T1-V2-CEDRO-WP-220','HA-T1-V3-LANCASTER-SP-082' /* … */)
--    order by sku;
-- =============================================================================
-- NOTA (no es parte de esta migración): el fix permanente del importador
-- (parseBanos() en 02_import_models.mjs) sigue pendiente de tu OK. Sin él,
-- un re-import volvería a dejar estos 27 en NULL. Ese es cambio de código,
-- no SQL — lo trato aparte cuando digas.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 0062_dedup_atlas_and_prices.sql
-- ─────────────────────────────────────────────────────────────────────
-- 3 bloques en UNA transacción:
--   1) Dedup: 80 SKUs duplicados (mismos style+variante+sc) — preservar
--      el más viejo (created_at, id). Re-asignar model_image_skus al
--      canónico antes de borrar.
--   2) Actualizar superficies ATLAS desde Hausind Atlas Housing Catalog.
--   3) Actualizar precios 168 SKUs únicos desde Hausind Catalog Prices
--      040626.xlsx.
-- Backup físico Supabase: 2026-06-05 12:47Z.
-- Backup CSV: INFO/backup_2026-06-05/{house_catalog,model_image_skus}.csv
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1) Dedup de house_catalog ───────────────────────────────────────
CREATE TEMP TABLE _hc_canonical AS
SELECT DISTINCT ON (linea, style_name, variante, sistema_constructivo)
  id AS canonical_id, linea, style_name, variante, sistema_constructivo
FROM house_catalog
ORDER BY linea, style_name, variante, sistema_constructivo,
         created_at NULLS LAST, id;

CREATE TEMP TABLE _hc_to_delete AS
SELECT hc.id AS dup_id, c.canonical_id
FROM house_catalog hc
JOIN _hc_canonical c
  ON c.linea = hc.linea
 AND c.style_name = hc.style_name
 AND COALESCE(c.variante, '') = COALESCE(hc.variante, '')
 AND c.sistema_constructivo = hc.sistema_constructivo
WHERE hc.id <> c.canonical_id;

-- Migrar vínculos a fotos al canónico. ON CONFLICT DO NOTHING evita
-- duplicar (canonical_id + image_id) si ya existe.
-- Como UPDATE no soporta ON CONFLICT, hacemos INSERT + DELETE:
INSERT INTO model_image_skus (house_catalog_id, image_id)
SELECT td.canonical_id, mis.image_id
FROM model_image_skus mis
JOIN _hc_to_delete td ON td.dup_id = mis.house_catalog_id
ON CONFLICT (house_catalog_id, image_id) DO NOTHING;

-- Borrar vínculos de los duplicados (ya quedaron como canonical).
DELETE FROM model_image_skus
WHERE house_catalog_id IN (SELECT dup_id FROM _hc_to_delete);

-- Borrar los SKUs duplicados.
DELETE FROM house_catalog
WHERE id IN (SELECT dup_id FROM _hc_to_delete);

-- ── 2) Superficies ATLAS ────────────────────────────────────────────
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 20.7
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 23.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 20.38
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 22.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 20.7
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 93.99, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '3.1';

-- ── 3) Precios (168 SKUs) ───────────────────────────────────────────
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'TROMEN' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'TROMEN' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'TROMEN' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'TROMEN' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'TROMEN' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'LANIN' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'COPAHUE' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'DOMUYO' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'TROMEN' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND UPPER(style_name) = 'MAHUIDA' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PAMPA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'ESCANDINAVIA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'LANCASTER' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'PATAGONIA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND UPPER(style_name) = 'CALIFORNIA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 278406.25, precio_contado_usd = 222725, precio_pozo_usd = 211588.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'AMBA''Y' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 448031.25, precio_contado_usd = 358425, precio_pozo_usd = 340503.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'AMBA''Y' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 278406.25, precio_contado_usd = 222725, precio_pozo_usd = 211588.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'LAPACHO' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 448031.25, precio_contado_usd = 358425, precio_pozo_usd = 340503.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'LAPACHO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 278406.25, precio_contado_usd = 222725, precio_pozo_usd = 211588.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CAMBOATA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 448031.25, precio_contado_usd = 358425, precio_pozo_usd = 340503.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CAMBOATA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ALECRIN' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ALECRIN' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'GUAYUBIRA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'GUAYUBIRA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'TIMBO' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'TIMBO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 234156.25, precio_contado_usd = 187325, precio_pozo_usd = 177958.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CEDRO' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 405625, precio_contado_usd = 324500, precio_pozo_usd = 308275
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CEDRO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 234156.25, precio_contado_usd = 187325, precio_pozo_usd = 177958.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'INGA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 405625, precio_contado_usd = 324500, precio_pozo_usd = 308275
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'INGA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 234156.25, precio_contado_usd = 187325, precio_pozo_usd = 177958.75
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ANCHICO' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 405625, precio_contado_usd = 324500, precio_pozo_usd = 308275
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ANCHICO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 302000, precio_contado_usd = 241600, precio_pozo_usd = 229520
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'AMBA''Y' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 486000, precio_contado_usd = 388800, precio_pozo_usd = 369360
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'AMBA''Y' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 302000, precio_contado_usd = 241600, precio_pozo_usd = 229520
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'LAPACHO' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 486000, precio_contado_usd = 388800, precio_pozo_usd = 369360
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'LAPACHO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 302000, precio_contado_usd = 241600, precio_pozo_usd = 229520
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CAMBOATA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 486000, precio_contado_usd = 388800, precio_pozo_usd = 369360
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CAMBOATA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ALECRIN' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ALECRIN' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'GUAYUBIRA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'GUAYUBIRA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'TIMBO' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'TIMBO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 254000, precio_contado_usd = 203200, precio_pozo_usd = 193040
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CEDRO' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 440000, precio_contado_usd = 352000, precio_pozo_usd = 334400
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'CEDRO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 254000, precio_contado_usd = 203200, precio_pozo_usd = 193040
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'INGA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 440000, precio_contado_usd = 352000, precio_pozo_usd = 334400
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'INGA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 254000, precio_contado_usd = 203200, precio_pozo_usd = 193040
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ANCHICO' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 440000, precio_contado_usd = 352000, precio_pozo_usd = 334400
  WHERE linea ILIKE '%BOSQUE%' AND UPPER(style_name) = 'ANCHICO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';

-- Sanity checks: deben coincidir con planilla.
-- SELECT COUNT(*) FROM house_catalog;  -- esperado: 168 (vs 248 previo)
-- SELECT COUNT(*) FROM model_image_skus;  -- esperado: ~igual o menos por dedup

COMMIT;

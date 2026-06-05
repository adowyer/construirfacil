-- ─────────────────────────────────────────────────────────────────────
-- 0064_prices_and_atlas_surfaces.sql
-- ─────────────────────────────────────────────────────────────────────
-- Updates de precios (planilla 040626) + superficies ATLAS (Atlas
-- Housing Catalog).
--
-- IMPORTANTE: NO hace dedup. La 0062 hizo dedup mal (no consideró
-- tipologia_code) y borró SKUs legítimos (Casa DECK COPAHUE ≠ Casa
-- CUBO COPAHUE). Se descartó vía restore del backup físico 12:47Z.
--
-- Si un modelo existe en 2 tipologías (CUBO + DECK) y la planilla
-- usa el mismo precio para ambas — el UPDATE afecta a ambas. Eso es
-- correcto (es como funcionaba antes y como la planilla cotiza).
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Superficies ATLAS ───────────────────────────────────────────────
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 20.7
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 23.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 50.35
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 20.38
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 42.51
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 22.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 44.39
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.27, area_semicubierta_m2 = 20.7
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '0';
UPDATE house_catalog SET area_m2 = 61.65, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1';
UPDATE house_catalog SET area_m2 = 81.93, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '2';
UPDATE house_catalog SET area_m2 = 90.85, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '3';
UPDATE house_catalog SET area_m2 = 93.99, area_semicubierta_m2 = 47.29
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '45660';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '3.1';
UPDATE house_catalog SET area_m2 = 44.63, area_semicubierta_m2 = 23.08
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '0.1';
UPDATE house_catalog SET area_m2 = 62.77, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1.1';
UPDATE house_catalog SET area_m2 = 68.48, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1.2';
UPDATE house_catalog SET area_m2 = 83.21, area_semicubierta_m2 = 31.02
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '2.1';
UPDATE house_catalog SET area_m2 = 94, area_semicubierta_m2 = 30.05
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '3.1';

-- ── Precios ─────────────────────────────────────────────────────────
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'TROMEN' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'TROMEN' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'TROMEN' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'TROMEN' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND style_name = 'TROMEN' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND style_name = 'LANÍN' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND style_name = 'COPAHUE' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND style_name = 'DOMUYO' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND style_name = 'TROMEN' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea ILIKE '%TERRA%' AND style_name = 'MAHUIDA' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '0' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 156718.75, precio_contado_usd = 125375, precio_pozo_usd = 119106.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '3.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 74856.25, precio_contado_usd = 59885, precio_pozo_usd = 56890.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '0.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 103803.125, precio_contado_usd = 83042.5, precio_pozo_usd = 78890.375
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 113206.25, precio_contado_usd = 90565, precio_pozo_usd = 86036.75
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1.2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 137543.75, precio_contado_usd = 110035, precio_pozo_usd = 104533.25
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '2.1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '0' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 170000, precio_contado_usd = 136000, precio_pozo_usd = 129200
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '3.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PAMPA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'ESCANDINAVIA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'LANCASTER' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'PATAGONIA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 81200, precio_contado_usd = 64960, precio_pozo_usd = 61712
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '0.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 112600, precio_contado_usd = 90080, precio_pozo_usd = 85576
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 122800, precio_contado_usd = 98240, precio_pozo_usd = 93328
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '1.2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 149200, precio_contado_usd = 119360, precio_pozo_usd = 113392
  WHERE linea ILIKE '%ATLAS%' AND style_name = 'CALIFORNIA' AND variante = '2.1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 278406.25, precio_contado_usd = 222725, precio_pozo_usd = 211588.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'AMBA''Y' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 448031.25, precio_contado_usd = 358425, precio_pozo_usd = 340503.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'AMBA''Y' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 278406.25, precio_contado_usd = 222725, precio_pozo_usd = 211588.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'LAPACHO' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 448031.25, precio_contado_usd = 358425, precio_pozo_usd = 340503.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'LAPACHO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 278406.25, precio_contado_usd = 222725, precio_pozo_usd = 211588.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CAMBOATÁ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 448031.25, precio_contado_usd = 358425, precio_pozo_usd = 340503.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CAMBOATÁ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ALECRÍN' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ALECRÍN' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'GUAYUBIRÁ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'GUAYUBIRÁ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'TIMBÓ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'TIMBÓ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 234156.25, precio_contado_usd = 187325, precio_pozo_usd = 177958.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CEDRO' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 405625, precio_contado_usd = 324500, precio_pozo_usd = 308275
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CEDRO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 234156.25, precio_contado_usd = 187325, precio_pozo_usd = 177958.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'INGÁ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 405625, precio_contado_usd = 324500, precio_pozo_usd = 308275
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'INGÁ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 234156.25, precio_contado_usd = 187325, precio_pozo_usd = 177958.75
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ANCHICO' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 405625, precio_contado_usd = 324500, precio_pozo_usd = 308275
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ANCHICO' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 302000, precio_contado_usd = 241600, precio_pozo_usd = 229520
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'AMBA''Y' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 486000, precio_contado_usd = 388800, precio_pozo_usd = 369360
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'AMBA''Y' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 302000, precio_contado_usd = 241600, precio_pozo_usd = 229520
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'LAPACHO' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 486000, precio_contado_usd = 388800, precio_pozo_usd = 369360
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'LAPACHO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 302000, precio_contado_usd = 241600, precio_pozo_usd = 229520
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CAMBOATÁ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 486000, precio_contado_usd = 388800, precio_pozo_usd = 369360
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CAMBOATÁ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ALECRÍN' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ALECRÍN' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'GUAYUBIRÁ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'GUAYUBIRÁ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'TIMBÓ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'TIMBÓ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 254000, precio_contado_usd = 203200, precio_pozo_usd = 193040
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CEDRO' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 440000, precio_contado_usd = 352000, precio_pozo_usd = 334400
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'CEDRO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 254000, precio_contado_usd = 203200, precio_pozo_usd = 193040
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'INGÁ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 440000, precio_contado_usd = 352000, precio_pozo_usd = 334400
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'INGÁ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 254000, precio_contado_usd = 203200, precio_pozo_usd = 193040
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ANCHICO' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 440000, precio_contado_usd = 352000, precio_pozo_usd = 334400
  WHERE linea ILIKE '%BOSQUE%' AND style_name = 'ANCHICO' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';

COMMIT;

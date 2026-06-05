-- ─────────────────────────────────────────────────────────────────────
-- 0063_fix_remaining_prices.sql
-- ─────────────────────────────────────────────────────────────────────
-- Fix de 29 SKUs cuyo precio NO se actualizó en 0062 porque el WHERE
-- usaba UPPER(style_name) = 'LANIN' (sin tilde) pero la DB tiene
-- LANÍN (con tilde) — mismo problema con ALECRÍN, CAMBOATÁ,
-- GUAYUBIRÁ, INGÁ, TIMBÓ.
--
-- Esta vez usamos el style_name EXACTO de la DB en cada UPDATE.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'ALECRÍN' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'ALECRÍN' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'ALECRÍN' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'TIMBÓ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '3' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 486000, precio_contado_usd = 388800, precio_pozo_usd = 369360
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'CAMBOATÁ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '2' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 80313.75, precio_contado_usd = 64251, precio_pozo_usd = 61038.45
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 440000, precio_contado_usd = 352000, precio_pozo_usd = 334400
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'INGÁ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'GUAYUBIRÁ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'GUAYUBIRÁ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 254000, precio_contado_usd = 203200, precio_pozo_usd = 193040
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'INGÁ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'GUAYUBIRÁ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 234156.25, precio_contado_usd = 187325, precio_pozo_usd = 177958.75
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'INGÁ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 596000, precio_contado_usd = 476800, precio_pozo_usd = 452960
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'GUAYUBIRÁ' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 405625, precio_contado_usd = 324500, precio_pozo_usd = 308275
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'INGÁ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 174240, precio_contado_usd = 139392, precio_pozo_usd = 132422.4
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '4' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '4' AND sistema_constructivo = 'STONE PLUS';
UPDATE house_catalog SET precio_lista_usd = 160627.5, precio_contado_usd = 128502, precio_pozo_usd = 122076.9
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '4' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 87120, precio_contado_usd = 69696, precio_pozo_usd = 66211.2
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '2' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 120470.625, precio_contado_usd = 96376.5, precio_pozo_usd = 91557.675
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '3' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 302000, precio_contado_usd = 241600, precio_pozo_usd = 229520
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'CAMBOATÁ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 549437.5, precio_contado_usd = 439550, precio_pozo_usd = 417572.5
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'TIMBÓ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 324000, precio_contado_usd = 259200, precio_pozo_usd = 246240
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'TIMBÓ' AND variante = '1' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'TIMBÓ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 298687.5, precio_contado_usd = 238950, precio_pozo_usd = 227002.5
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'ALECRÍN' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 130680, precio_contado_usd = 104544, precio_pozo_usd = 99316.8
  WHERE linea = 'LÍNEA TERRA' AND style_name = 'LANÍN' AND variante = '3' AND sistema_constructivo = 'STEEL PLUS';
UPDATE house_catalog SET precio_lista_usd = 278406.25, precio_contado_usd = 222725, precio_pozo_usd = 211588.75
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'CAMBOATÁ' AND variante = '1' AND sistema_constructivo = 'WOOD PLUS';
UPDATE house_catalog SET precio_lista_usd = 448031.25, precio_contado_usd = 358425, precio_pozo_usd = 340503.75
  WHERE linea = 'LÍNEA BOSQUE' AND style_name = 'CAMBOATÁ' AND variante = '2' AND sistema_constructivo = 'WOOD PLUS';

COMMIT;

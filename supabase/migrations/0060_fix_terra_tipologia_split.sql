-- =============================================================================
-- ConstruirFácil — fix: Terra V3 SKUs cruzados entre CUBO/DECK
-- Migration: 0060_fix_terra_tipologia_split.sql
-- =============================================================================
-- Bug observado: en `house_catalog` los SKUs de TERRA con variante=3 quedaron
-- con `tipologia_code_new` cruzado:
--   • Tip O V3 → estaba como DECK (debe ser CUBO)
--   • Tip U V3 → estaba como CUBO (debe ser DECK)
-- Probable origen: corrida parcial de migraciones de naming (0046 / 0068).
--
-- Regla autoritativa según planilla "Hausind Catalog Prices 040626.xlsx"
-- (hoja SUPERFICIES COSTOS OK):
--   • Tip O (legacy) = CUBO
--   • Tip U (legacy) = DECK
--   • Tip Z (legacy) = ZETA
--
-- Efecto en UI: el panel de Estilos del catálogo deja de mostrar pills
-- duplicadas para los modelos cuyas variantes estaban split (DOMUYO,
-- COPAHUE, etc.).
--
-- IDEMPOTENTE: el UPDATE no tiene efecto si los valores ya están correctos.
-- =============================================================================

begin;

-- Tip O → CUBO
update public.house_catalog
   set tipologia_code_new = 'CUBO'
 where linea ilike '%terra%'
   and tipologia_code = 'O'
   and tipologia_code_new is distinct from 'CUBO';

-- Tip U → DECK
update public.house_catalog
   set tipologia_code_new = 'DECK'
 where linea ilike '%terra%'
   and tipologia_code = 'U'
   and tipologia_code_new is distinct from 'DECK';

-- Tip Z → ZETA (defensivo: ya debería estar OK)
update public.house_catalog
   set tipologia_code_new = 'ZETA'
 where linea ilike '%terra%'
   and tipologia_code = 'Z'
   and tipologia_code_new is distinct from 'ZETA';

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select tipologia_code, tipologia_code_new, style_name,
--        array_agg(distinct variante order by variante) as vars
--   from house_catalog
--  where linea ilike '%terra%'
--  group by tipologia_code, tipologia_code_new, style_name
--  order by tipologia_code, tipologia_code_new, style_name;
--
-- Esperado: una sola fila por (tip, casa) — sin duplicados CUBO/DECK
-- =============================================================================

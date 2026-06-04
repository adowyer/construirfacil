-- =============================================================================
-- ConstruirFácil — Rename tipologías: EJE → EJES, NODO → CUBO
-- Migration: 0052_renombrar_tipologias_eje_y_nodo.sql
-- =============================================================================
-- Decisión del founder (sesión 2026-06-02): renombrar las 2 tipologías para
-- alinear el naming visible al cliente con la intención editorial:
--   • EJE  → EJES  (el catálogo ya mostraba "EJES" en /admin pero la DB tenía
--                   "EJE" → fix de la inconsistencia + cambio de naming)
--   • NODO → CUBO  (cambio editorial: "CUBO" comunica mejor la idea de
--                   "ambiente compacto integrado")
--
-- Migración PURA: sin redirects, sin compatibility shims. Los slugs viejos
-- (`casa-eje-*` y `casa-nodo-*`) dejan de existir y se reemplazan por los
-- nuevos (`casa-ejes-*` y `casa-cubo-*`). Decisión consciente: el producto
-- no tiene URLs en producción que dependan de esos slugs todavía, mejor
-- empezar limpio que arrastrar deuda.
--
-- Tablas afectadas (TODAS donde puede vivir un código de tipología "new"):
--   1. public.tipologia_catalog       — librería compartida (code + nombre)
--   2. public.house_catalog           — tipologia_code_new del SKU
--   3. public.model_content           — si existe tipologia_code_new
--   4. public.line_content            — si existe tipologia_code_new
--
-- Idempotente: WHERE filtra por valor viejo → re-correr no rompe.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. tipologia_catalog (librería de tipologías)
-- ---------------------------------------------------------------------------
update public.tipologia_catalog
   set code = 'EJES',
       nombre = 'Tipología EJES'
 where code = 'EJE';

update public.tipologia_catalog
   set code = 'CUBO',
       nombre = 'Tipología CUBO'
 where code = 'NODO';

-- ---------------------------------------------------------------------------
-- 2. house_catalog (un código por SKU)
-- ---------------------------------------------------------------------------
update public.house_catalog
   set tipologia_code_new = 'EJES'
 where tipologia_code_new = 'EJE';

update public.house_catalog
   set tipologia_code_new = 'CUBO'
 where tipologia_code_new = 'NODO';

-- ---------------------------------------------------------------------------
-- 3. model_content (si el contenido referencia tipologia_code_new)
--    Guarded with DO block — algunas instalaciones no tienen la columna.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'model_content'
       and column_name = 'tipologia_code_new'
  ) then
    update public.model_content
       set tipologia_code_new = 'EJES'
     where tipologia_code_new = 'EJE';

    update public.model_content
       set tipologia_code_new = 'CUBO'
     where tipologia_code_new = 'NODO';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. line_content (si el contenido referencia tipologia_code_new)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'line_content'
       and column_name = 'tipologia_code_new'
  ) then
    update public.line_content
       set tipologia_code_new = 'EJES'
     where tipologia_code_new = 'EJE';

    update public.line_content
       set tipologia_code_new = 'CUBO'
     where tipologia_code_new = 'NODO';
  end if;
end $$;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte, fuera de la transacción)
-- =============================================================================
-- 1) tipologia_catalog: 0 viejos, 2 nuevos
--    select code from public.tipologia_catalog where code in ('EJE','NODO','EJES','CUBO') order by code;
--    Esperado: CUBO, EJES (sin EJE ni NODO).
--
-- 2) house_catalog: 0 viejos
--    select count(*) from public.house_catalog where tipologia_code_new in ('EJE','NODO');
--    Esperado: 0.
--
-- 3) Distribución por tipología (sanity check):
--    select tipologia_code_new, count(*)
--      from public.house_catalog
--     where tipologia_code_new is not null
--     group by 1
--     order by 1;
-- =============================================================================
-- NOTA (no es parte de esta migración): los comentarios en code (model-naming.ts,
-- model-slug.ts, CatalogPage.tsx, ExpandedPanels.tsx) mencionan "EJE/NODO" como
-- ejemplos. Esos comentarios se actualizan aparte — no afectan runtime.
-- =============================================================================

-- =============================================================================
-- ConstruirFácil — show_prices: default true + flip existentes a true
-- Migration: 0044_marca_show_prices_default_true.sql
-- =============================================================================
-- Política nueva: por default, las marcas publican precios en el catálogo.
-- El flag sigue existiendo (por si una marca pide ocultar puntualmente), pero
-- a partir de ahora una marca nueva arranca con `show_prices = true`. Se
-- actualizan las filas existentes para que el catálogo muestre el precio
-- (fmtPrecioFicha en ModelRow.tsx leía show_prices=false → "Cotizar").
--
-- Reversible: bajar el default y/o setear show_prices=false en marcas
-- específicas vía /admin/marcas.
-- =============================================================================

-- 1) Default a true para inserts futuros.
alter table public.marcas
  alter column show_prices set default true;

-- 2) Flip de filas existentes que estuviesen en false (era el default viejo).
update public.marcas
   set show_prices = true
 where show_prices = false;

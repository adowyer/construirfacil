-- 0015_marcas_show_prices.sql
-- Flag por marca para mostrar/ocultar precios en el catálogo público.
-- Default false → toda marca arranca ocultando precios (la card del SKU
-- muestra "Cotizar"). El admin de cada marca puede activarlo cuando quiera.

alter table public.marcas
  add column if not exists show_prices boolean not null default false;

comment on column public.marcas.show_prices is
  'Si true, el catálogo público muestra precios de los SKUs de esta marca; si false, muestra "Cotizar".';

-- 0097_marcas_engagement_plan.sql
-- Dos políticas POR MARCA para el engagement automático CF + Ximia (ver docs/engagement/DESIGN.md).
--
-- 1) plan            → qué contrató la marca: sólo CF vs CF + Ximia. Rutea el workflow del lead:
--                      'cf'       = bienvenida marketplace + SLA de vigilancia 48h (Segmento C).
--                      'cf_ximia' = precalificación por Ximia + lead calificado a la marca (Segmento B).
-- 2) price_visibility → política de precios del catálogo, configurable y cambiable por cada marca:
--                      'public' = precios visibles sin registro.
--                      'gated'  = ocultos hasta que el visitante se registra (OTP) → lo capturamos como
--                                 'warm' y arranca el nurture (Segmento A). Modelo ML/ZonaProp invertido.
--                      'hidden' = precios nunca en el marketplace.
--
-- Nota: price_visibility SUPERSEDE al booleano `marcas.show_prices`. La migración del código del catálogo
-- que hoy lee `show_prices` queda PENDIENTE (ver DESIGN.md §7.2): no se toca `show_prices` acá para no
-- romper el catálogo vivo. Default 'gated' = captura-first, alineado al negocio (vender casas, no tráfico).
--
-- Hausind (única marca hoy) → price_visibility='gated' por pedido de Guillermo; plan='cf_ximia' (es la
-- marca flagship y el piloto de Ximia; confirmado por Andrea 2026-07-17). Ojo: Ximia aún no está live
-- (XIMIA_LIVE=false) → el ruteo B queda armado pero el paso de precalificación se enciende al prender Ximia.

alter table public.marcas
  add column if not exists plan text not null default 'cf'
    check (plan in ('cf', 'cf_ximia')),
  add column if not exists price_visibility text not null default 'gated'
    check (price_visibility in ('public', 'gated', 'hidden'));

comment on column public.marcas.plan is
  'Contrato de la marca: cf (sólo marketplace) | cf_ximia (marketplace + precalificación Ximia). Rutea el workflow de engagement. Ver docs/engagement/DESIGN.md.';
comment on column public.marcas.price_visibility is
  'Política de precios del catálogo por marca: public | gated (registro para ver) | hidden. Supersede show_prices. Ver docs/engagement/DESIGN.md.';

-- Backfill explícito de las marcas existentes (idempotente): default ya deja todo en 'gated', pero lo
-- dejamos escrito para que quede claro en el historial. Hausind = gated.
update public.marcas set price_visibility = 'gated' where price_visibility is null;

-- Hausind contrató CF + Ximia (confirmado Andrea 2026-07-17).
update public.marcas set plan = 'cf_ximia' where slug = 'hausind';

-- =============================================================================
-- ConstruirFácil — Ofertas por SKU (descuento + badge + expiración)
-- Migration: 0048_ofertas.sql
-- =============================================================================
-- Cada SKU del catálogo puede activarse como oferta. El admin marca el flag,
-- setea un % de descuento, un label opcional para el badge ("Liquidación",
-- "Oferta lanzamiento", default "Oferta") y opcionalmente una fecha de
-- expiración.
--
-- Aplicación al precio (en el catálogo público):
--   precio_final = precio_base × (1 − offer_pct/100) × (1 + zone_modifier/100)
--                  + zone_extra_charge
--
-- La oferta se aplica primero (descuento sobre el precio base), luego se
-- compone con la regla zonal de la provincia activa. El cliente ve un único
-- precio + el precio original tachado.
--
-- offer_until permite expirar automáticamente sin tener que apagar el flag
-- a mano. NULL = sin expiración.
--
-- IDEMPOTENTE.
-- =============================================================================

begin;

alter table public.house_catalog
  add column if not exists is_offer     boolean not null default false,
  add column if not exists offer_pct    numeric(5, 2),
  add column if not exists offer_label  text,
  add column if not exists offer_until  date;

comment on column public.house_catalog.is_offer is
  'Toggle de oferta por SKU. Si false, los otros campos de oferta se ignoran.';
comment on column public.house_catalog.offer_pct is
  'Descuento aplicado al precio base. 10.00 = -10%. NULL = sin descuento (es solo badge).';
comment on column public.house_catalog.offer_label is
  'Texto del badge visible (ej. "Liquidación", "Promo lanzamiento"). NULL → "Oferta".';
comment on column public.house_catalog.offer_until is
  'Fecha en que la oferta deja de aplicarse. NULL = sin expiración. El catálogo público compara contra hoy.';

create index if not exists idx_house_catalog_is_offer on public.house_catalog (is_offer) where is_offer = true;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='house_catalog'
--     and column_name like 'offer%' or column_name='is_offer';
-- =============================================================================

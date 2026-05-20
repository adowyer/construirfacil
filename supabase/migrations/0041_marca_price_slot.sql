-- =============================================================================
-- ConstruirFácil — marca_price_slot (nombres de precio + precio base por marca)
-- Migration: 0041_marca_price_slot.sql
-- =============================================================================
-- Multimarca: cada proveedor tiene su propia estructura comercial de precios.
-- house_catalog guarda 3 columnas físicas (precio_lista_usd / _contado_usd /
-- _pozo_usd) que pasan a ser "slots" genéricos. Esta tabla les da SEMÁNTICA
-- por marca:
--   - label    : cómo el proveedor llama a ese precio (Lista / Contado / Pozo,
--                 o Lanzamiento / Oferta / etc — texto libre).
--   - is_base  : cuál de los slots es el precio "sugerido" sobre el que el
--                cotizador Uber aplica los deltas (fast +25 / cupo 0 / -10).
--                EXACTAMENTE uno por marca (índice único parcial).
--   - enabled  : un proveedor con 1 ó 2 precios deshabilita los que no usa.
--
-- NO se toca house_catalog (cero refactor de lecturas, riesgo nulo sobre el
-- catálogo vivo). Los precios siguen en sus columnas; sólo el NOMBRE y el ROL
-- se resuelven acá. Si algún día un proveedor necesita >3 precios o sets por
-- SKU, este slot es la costura para graduar a una tabla hija house_catalog_price.
--
-- DISPLAY data (el catálogo público lee labels + base) → RLS + grant select
-- público + policy using(true), igual que pricing_tiers (lección 0030/0031).
-- Writes = service-role.
--
-- Idempotente. Correr en BLOQUES en el editor SQL de Supabase.
-- =============================================================================

create table if not exists public.marca_price_slot (
  id          uuid primary key default gen_random_uuid(),
  marca_id    uuid not null references public.marcas(id) on delete cascade,
  slot_key    text not null check (slot_key in ('lista','contado','pozo')),
  label       text not null,
  is_base     boolean not null default false,
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now(),
  unique (marca_id, slot_key)
);

comment on table public.marca_price_slot is
  'Semántica de precios por marca sobre las 3 columnas de house_catalog. label = nombre libre del proveedor; is_base = precio sugerido que usa el cotizador (1 por marca); enabled = el proveedor usa ese slot.';

-- Exactamente UN precio base por marca (parcial: sólo donde is_base).
create unique index if not exists marca_price_slot_one_base
  on public.marca_price_slot (marca_id) where is_base;

-- updated_at (función compartida 0005).
drop trigger if exists marca_price_slot_updated_at on public.marca_price_slot;
create trigger marca_price_slot_updated_at
  before update on public.marca_price_slot
  for each row execute procedure public.handle_updated_at();

-- Lectura pública (display); writes = service-role (bypassa RLS).
grant select on table public.marca_price_slot to anon, authenticated;
alter table public.marca_price_slot enable row level security;
drop policy if exists "marca_price_slot public read" on public.marca_price_slot;
create policy "marca_price_slot public read"
  on public.marca_price_slot for select using (true);

-- Seed Hausind: Lista (base) / Contado / Pozo, los 3 habilitados. Sólo si la
-- marca no tiene slots todavía (idempotente). marca_id se resuelve por slug.
insert into public.marca_price_slot
  (marca_id, slot_key, label, is_base, enabled, sort_order)
select m.id, v.slot_key, v.label, v.is_base, v.enabled, v.sort_order
from public.marcas m
cross join (values
  ('lista'::text,   'Lista'::text,   true,  true, 1),
  ('contado'::text, 'Contado'::text, false, true, 2),
  ('pozo'::text,    'Pozo'::text,    false, true, 3)
) as v(slot_key, label, is_base, enabled, sort_order)
where m.slug = 'hausind'
  and not exists (
    select 1 from public.marca_price_slot s where s.marca_id = m.id
  );

-- =============================================================================
-- select m.name, s.slot_key, s.label, s.is_base, s.enabled, s.sort_order
--   from public.marca_price_slot s
--   join public.marcas m on m.id = s.marca_id
--  order by m.name, s.sort_order;
-- =============================================================================

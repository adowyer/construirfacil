-- =============================================================================
-- ConstruirFácil — pricing_tiers + pricing_config (Cotizador "Uber")
-- Migration: 0040_pricing_tiers.sql
-- =============================================================================
-- Cotizador estilo Uber: el selector elige el PRECIO TOTAL (trade-off
-- cupo/plazo) y la cuota se deriva de la tabla bank_financing (misma fuente
-- que usa Ximia). Spec: docs/cotizador-uber-spec.md.
--
-- pricing_tiers  : los 3 tramos con la regla real (fast +25%, cupo 0% base,
--                  espera y ahorra -10%). Editables en /admin.
-- pricing_config : singleton (id=1). usd_ars_ref NULL a propósito → el motor
--                  de cuota DEGRADA (no muestra cuota) hasta que se cargue
--                  el T.C. real. Nunca un peso inventado.
--
-- DISPLAY data (el catálogo público las lee) → RLS + grant select público +
-- policy using(true), igual que las tablas de contenido (lección 0030/0031).
-- Writes = service-role. bank_financing NO se toca acá (es de Ximia, mismo
-- Supabase, sólo lectura server-side con service-role).
--
-- Idempotente. Correr en BLOQUES en el editor SQL de Supabase.
-- =============================================================================

create table if not exists public.pricing_tiers (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null unique,        -- fast | cupo | sin_apuro
  label              text not null,
  lead_time_label    text,                        -- "menos de 6 meses"
  lead_time_months   int,                         -- referencia opcional
  price_modifier_pct numeric not null default 0,  -- +caro / -barato (AJUSTAR)
  highlighted        boolean not null default false,
  sort_order         int not null default 0,
  active             boolean not null default true,
  updated_at         timestamptz not null default now()
);

comment on table public.pricing_tiers is
  'Tramos del cotizador Uber. price_modifier_pct = delta sobre el precio de lista (fast +25, cupo 0 base, espera y ahorra -10). Editable en admin.';

create table if not exists public.pricing_config (
  id           int primary key default 1 check (id = 1),  -- singleton
  usd_ars_ref  numeric,                                    -- NULL = degrada
  fx_ref_date  date,
  caveat_html  text,
  updated_at   timestamptz not null default now()
);

comment on table public.pricing_config is
  'Singleton (id=1). T.C. de referencia USD→ARS + fecha + caveat. usd_ars_ref NULL → el cotizador no muestra cuota (sin números falsos).';

-- updated_at (función compartida 0005).
drop trigger if exists pricing_tiers_updated_at on public.pricing_tiers;
create trigger pricing_tiers_updated_at
  before update on public.pricing_tiers
  for each row execute procedure public.handle_updated_at();
drop trigger if exists pricing_config_updated_at on public.pricing_config;
create trigger pricing_config_updated_at
  before update on public.pricing_config
  for each row execute procedure public.handle_updated_at();

-- Lectura pública (display); writes = service-role (bypassa RLS).
grant select on table public.pricing_tiers  to anon, authenticated;
grant select on table public.pricing_config to anon, authenticated;
alter table public.pricing_tiers  enable row level security;
alter table public.pricing_config enable row level security;
drop policy if exists "pricing_tiers public read"  on public.pricing_tiers;
drop policy if exists "pricing_config public read" on public.pricing_config;
create policy "pricing_tiers public read"
  on public.pricing_tiers  for select using (true);
create policy "pricing_config public read"
  on public.pricing_config for select using (true);

-- Seed: los 3 tramos con la regla real (fast +25%, cupo 0% base, -10%).
insert into public.pricing_tiers
  (key, label, lead_time_label, lead_time_months, price_modifier_pct, highlighted, sort_order)
select * from (values
  ('fast',      'Lo quiero ya',     'menos de 6 meses', null::int,  25::numeric, false, 1),
  ('cupo',      'Cupo',             '6 meses',          6,           0::numeric, true,  2),
  ('sin_apuro', 'Espera y ahorra',  'cupo grande',      null::int, -10::numeric, false, 3)
) as v(key, label, lead_time_label, lead_time_months, price_modifier_pct, highlighted, sort_order)
where not exists (select 1 from public.pricing_tiers);

-- Seed: config singleton. T.C. NULL (degrada). Caveat = copy ya depurada.
insert into public.pricing_config (id, usd_ars_ref, fx_ref_date, caveat_html)
select 1, null, null,
  '<p>Cuota inicial estimada en pesos, ajustable por UVA. El valor final depende de la casa que diseñes (variante, sistema constructivo y tipología) y de tu precalificación. Financiamos con Banco Nación, Banco Hipotecario, Banco de Neuquén y financiación privada si no llegás al 100%. Sujeto a aprobación crediticia de la entidad.</p>'
where not exists (select 1 from public.pricing_config);

-- =============================================================================
-- select key, label, lead_time_label, price_modifier_pct from public.pricing_tiers order by sort_order;
-- select usd_ars_ref, fx_ref_date from public.pricing_config;
-- =============================================================================

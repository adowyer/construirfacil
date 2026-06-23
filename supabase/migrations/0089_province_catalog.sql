-- 0089_province_catalog.sql
-- Motor multi-marca: catálogo EFECTIVO por provincia (disponibilidad + precio zonal).
-- Replica en SQL la resolución de marca_zonas que hoy vive en TS (lib/content/zones.ts):
--   - most-specific-wins (score = linea×2 + sc×1) para excluded/contact_only/modifier/promo
--   - extra_charge SIEMPRE de la regla general (linea=null, sc=null)
--   - precio efectivo = base × (1 + modifier%/100) + extra_charge  (a los 3 tiers)
--   - excluded=true → fuera; marca no `recommendable` → fuera (deny-list futura)
-- recommend_house/evaluate consultan ESTO en vez de `house_catalog where brand='HAUSIND'`.
-- Single source: la web podría migrar a la misma función.
-- DDL: la corre Andrea a mano.

-- (1) Flag de marca recommendable en el marketplace (hoy todas true; deny-list = false).
alter table public.marcas
  add column if not exists recommendable boolean not null default true;
comment on column public.marcas.recommendable is
  'La marca se recomienda en el marketplace (pagó/activa). false = deny-list (nunca recomendar).';

-- (2) Catálogo efectivo por provincia.
create or replace function public.province_catalog(p_province text)
returns table (
  sku                       text,
  marca_id                  uuid,
  brand                     text,
  marca_name                text,
  style_name                text,
  linea                     text,
  estilo                    text,
  sistema_constructivo      text,
  area_m2                   numeric,
  min_bedrooms              int,
  max_bedrooms              int,
  brochure                  text,
  precio_contado_usd        numeric,
  precio_pozo_usd           numeric,
  precio_lista_usd          numeric,
  costo_no_financiable_usd  numeric,
  contact_only              boolean,
  promo_label               text
)
language sql
stable
as $$
  with prov as (
    select id from public.provincias
    where slug = translate(lower(p_province), 'áéíóúñ', 'aeioun')
       or name ilike p_province
    limit 1
  )
  select
    hc.sku, hc.marca_id, hc.brand, m.name,
    hc.style_name, hc.linea, hc.estilo, hc.sistema_constructivo,
    hc.area_m2::numeric, hc.min_bedrooms::int, hc.max_bedrooms::int,
    coalesce(hc.brochure_url, hc.pdf_url),
    round(hc.precio_contado_usd * (1 + coalesce(best.price_modifier_pct, 0) / 100.0) + coalesce(gen.extra_charge_amount, 0)),
    round(hc.precio_pozo_usd    * (1 + coalesce(best.price_modifier_pct, 0) / 100.0) + coalesce(gen.extra_charge_amount, 0)),
    round(hc.precio_lista_usd   * (1 + coalesce(best.price_modifier_pct, 0) / 100.0) + coalesce(gen.extra_charge_amount, 0)),
    hc.costo_no_financiable_usd,
    coalesce(best.contact_only, false),
    best.promo_label
  from public.house_catalog hc
  join public.marcas m
    on m.id = hc.marca_id and coalesce(m.recommendable, true) = true
  -- regla más específica que matchea (flags + modifier + promo)
  left join lateral (
    select r.excluded, r.contact_only, r.price_modifier_pct, r.promo_label
    from public.marca_zonas r
    where r.status = 'active'
      and r.marca_id = hc.marca_id
      and r.provincia_id = (select id from prov)
      and (r.linea_id is null or r.linea_id = hc.linea_id)
      and (r.sistema_constructivo is null or r.sistema_constructivo = hc.sistema_constructivo)
    order by (case when r.linea_id is not null then 2 else 0 end)
           + (case when r.sistema_constructivo is not null then 1 else 0 end) desc
    limit 1
  ) best on true
  -- extra_charge SIEMPRE de la regla general (linea=null, sc=null)
  left join lateral (
    select r.extra_charge_amount
    from public.marca_zonas r
    where r.status = 'active'
      and r.marca_id = hc.marca_id
      and r.provincia_id = (select id from prov)
      and r.linea_id is null and r.sistema_constructivo is null
    limit 1
  ) gen on true
  where lower(trim(coalesce(hc.status, 'active'))) = 'active'
    and hc.precio_contado_usd is not null
    and coalesce(best.excluded, false) = false;   -- exclusión por provincia
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de confiar)
-- -----------------------------------------------------------------------------
-- (A) Cuántas casas disponibles en Neuquén (debería traer las de HAUSIND no excluidas).
select 'A) Neuquén — disponibles' as chk, count(*) from public.province_catalog('Neuquén');

-- (B) Muestra: sku, marca, precio efectivo vs precio base (para ver si el zonal aplica).
select 'B) efectivo vs base' as chk, pc.sku, pc.brand, pc.precio_contado_usd as efectivo,
       hc.precio_contado_usd as base,
       round(pc.precio_contado_usd - hc.precio_contado_usd) as delta_zonal
  from public.province_catalog('Neuquén') pc
  join public.house_catalog hc on hc.sku = pc.sku
 order by abs(pc.precio_contado_usd - hc.precio_contado_usd) desc
 limit 8;

-- (C) Una marca puesta como recommendable=false NO debe aparecer (probar a mano si hay 2+ marcas).
-- (D) Una provincia donde HAUSIND esté excluida en marca_zonas → 0 filas de esa marca.

-- 0094_province_catalog_model_slug.sql
-- province_catalog ahora devuelve `model_slug`: la URL canónica del modelo en el
-- catálogo (/modelos/<slug>). Así Ximia LEE el slug en vez de reconstruirlo (cero
-- drift). Replica modelGroupSlug de lib/content/model-slug.ts:
--   casa-<circulacion>-<morfologia>-<style>   (modo nuevo, post-0090)
--   casa-<tipologia_code_new>-<style>         (modo legacy)
--   casa-<style>                              (si falta tipología)
-- Ej.: {circulacion:'EJES', morfologia:'CUBO', style_name:'GUAYUBIRA'} -> casa-ejes-cubo-guayubira
-- DDL: la corre Andrea a mano.
--
-- NOTA drift: la FUENTE canónica del slug sigue siendo model-slug.ts (TS). Esta es
-- una RÉPLICA en SQL para la ruta de lectura de Ximia. Si el catálogo cambia el
-- formato del slug, actualizar AMBOS. token() acá cubre á é í ó ú ü ñ + quita
-- comillas; si aparecen estilos con otros caracteres, extender el translate.

-- (1) token(): espejo de token() de model-slug.ts (strip acentos -> lower -> quita
--     comillas -> no-alfanumérico a '-' -> trim '-').
create or replace function public.cf_slug_token(p text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      translate(lower(coalesce(p, '')), 'áéíóúüñ', 'aeiouun'),
      '[''`´’]', '', 'g'),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- (2) province_catalog + model_slug.
-- Agregamos una columna al returns table → cambia el tipo de retorno → hay que dropear
-- primero (create or replace no alcanza). Seguro: PG no trackea llamadas función→función,
-- y present_product la consulta en runtime desde n8n (no es objeto dependiente).
drop function if exists public.province_catalog(text);
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
  promo_label               text,
  model_slug                text
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
    best.promo_label,
    -- model_slug: espejo de modelGroupSlug (sin variante)
    case
      when nullif(trim(hc.circulacion), '') is not null and nullif(trim(hc.morfologia), '') is not null
        then concat_ws('-', 'casa',
               public.cf_slug_token(hc.circulacion),
               public.cf_slug_token(hc.morfologia),
               nullif(public.cf_slug_token(hc.style_name), ''))
      when nullif(trim(hc.tipologia_code_new), '') is not null
        then concat_ws('-', 'casa',
               public.cf_slug_token(hc.tipologia_code_new),
               nullif(public.cf_slug_token(hc.style_name), ''))
      else
        concat_ws('-', 'casa', nullif(public.cf_slug_token(hc.style_name), ''))
    end as model_slug
  from public.house_catalog hc
  join public.marcas m
    on m.id = hc.marca_id and coalesce(m.recommendable, true) = true
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
    and coalesce(best.excluded, false) = false;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN
-- -----------------------------------------------------------------------------
-- (A) Los slugs de Neuquén deben verse como casa-ejes-cubo-guayubira (probar uno en
--     el navegador: /modelos/<slug>).
select 'A) slugs Neuquén' as chk, style_name, circulacion_morfo.*
  from public.province_catalog('Neuquén'),
       lateral (select model_slug) circulacion_morfo
 order by model_slug
 limit 12;

-- (B) Ningún slug debe ser solo 'casa' o terminar en '-' (señal de datos faltantes).
select 'B) slugs sospechosos' as chk, sku, style_name, model_slug
  from public.province_catalog('Neuquén')
 where model_slug = 'casa' or model_slug like '%-'
 limit 20;

-- (C) Sanity puntual: guayubira ejes/cubo -> casa-ejes-cubo-guayubira
select 'C) guayubira' as chk, model_slug
  from public.province_catalog('Neuquén')
 where lower(style_name) = 'guayubira'
 limit 5;

-- =============================================================================
-- 0071 — evaluate_project_affordability v4: gap del SKU DESEADO + margen sobre
--        costo_no_financiable + tier de precio elegible.
--
-- ⚠️ DRAFT para revisar por Andrea. Correr dentro de begin/commit y mirar las
--    VERIFICACIONES antes de COMMIT.
--
-- Qué cambia vs 0068 (validado contra Esquema_Financiero.md v2):
--   (1) CASA COTIZADA: si viene p_target_variant_code → TODO se calcula para esa
--       casa. Si NO viene → la casa MÁS CARA que el cliente puede pagar (vender a
--       capacidad, no la más barata). Si ninguna es financiable → la más barata
--       (gap honesto). Antes: siempre la más barata global (subventa + mismatch).
--   (2) MARGEN sobre costo_no_financiable (col nueva 0070), NO sobre costo_plano:
--       margen_financiable = precio_tier − costo_no_financiable.
--       gap_financeable = gap<=0 OR (gap <= margen AND gap <= pool_headroom).
--   (3) TIER de precio: p_price_tier ('lista'|'contado'|'pozo'), default 'contado'
--       (= Cupo). El precio sale de la columna explícita, no de un descuento aprox.
--   (4) Devuelve resolved_sku/style/tier/margen para que el agente sepa qué cotizó.
--
-- Compat: mantiene las columnas de salida de 0068 (ref_* ahora = la casa cotizada,
--   así el Shape de casa_lote sigue leyendo gap_financeable_ref / funding_gap_ref_usd
--   sin romperse). Agrega 4 columnas al final.
-- =============================================================================
begin;

drop function if exists public.evaluate_project_affordability(text, numeric, numeric, numeric, text);

create or replace function public.evaluate_project_affordability(
  p_project_slug        text,
  p_bank_loan_usd       numeric,
  p_savings_usd         numeric,
  p_client_equity_usd   numeric default 0,
  p_target_variant_code text    default null,
  p_price_tier          text    default 'contado'   -- NEW: 'lista'|'contado'|'pozo'
)
returns table (
  project_id uuid, project_slug text,
  reference_sale_price_usd numeric, target_sale_price_usd numeric, total_funds_usd numeric,
  funding_gap_ref_usd numeric, funding_gap_target_usd numeric, gap_pct_ref numeric,
  margin_pool_usd numeric, private_committed_usd numeric, private_headroom_usd numeric,
  construction_quota_required_usd numeric, pool_covers_construction boolean,
  gap_financeable_ref boolean, gap_financeable_target boolean,
  minimum_units_to_start integer, quota_total_slots integer, quota_available_slots integer,
  units_sold_in_quota integer, units_until_obra_start integer, calc_version text,
  resolved_sku text, resolved_style text, price_tier text, margin_financiable_usd numeric
)
language plpgsql
as $$
declare
  v_proj public.projects%rowtype;
  v_lot numeric; v_funds numeric; v_tier text;
  v_cq_total int; v_cq_avail int; v_cq_pool numeric;
  v_committed numeric; v_headroom numeric;
  v_sku text; v_style text; v_nofin numeric; v_tier_price numeric;
  v_sale numeric; v_margin numeric; v_gap numeric; v_fin boolean; v_gap_pct numeric;
  v_sold int; v_until int;
begin
  v_tier  := case lower(coalesce(p_price_tier,'contado'))
               when 'lista' then 'lista' when 'pozo' then 'pozo' else 'contado' end;
  v_funds := coalesce(p_bank_loan_usd,0) + coalesce(p_savings_usd,0) + coalesce(p_client_equity_usd,0);

  select * into v_proj from public.projects p
   where p.project_slug = p_project_slug and p.is_active is distinct from false limit 1;
  if not found then
    return query select null::uuid, p_project_slug, null::numeric,null::numeric,v_funds,
      null::numeric,null::numeric,null::numeric,null::numeric,null::numeric,null::numeric,null::numeric,
      false,false,false,null::int,null::int,null::int,null::int,null::int,
      'v4-project-not-found'::text, null::text,null::text,v_tier,null::numeric;
    return;
  end if;

  select min(l.price_usd) into v_lot from public.lots_inventory l
   where l.project_id = v_proj.id and lower(trim(l.status)) = 'available';
  v_lot := coalesce(v_lot,0);

  select coalesce(cq.total_slots,0), coalesce(cq.available_slots,0), coalesce(cq.margin_pool_usd,0)
    into v_cq_total, v_cq_avail, v_cq_pool
    from public.construction_quotas cq
   where cq.project_id = v_proj.id and lower(trim(coalesce(cq.status,'open'))) = 'open'
   order by cq.created_at desc nulls last limit 1;
  v_cq_total := coalesce(v_cq_total,0); v_cq_avail := coalesce(v_cq_avail,0); v_cq_pool := coalesce(v_cq_pool,0);

  select coalesce(sum(pfc.amount_usd_committed),0) into v_committed
    from public.private_financing_commitments pfc
   where pfc.project_id = v_proj.id and pfc.status = any (array['pending','confirmed']);
  v_committed := coalesce(v_committed,0);
  v_headroom  := greatest(0, v_cq_pool - v_committed);

  -- helper: precio del tier elegido por SKU
  -- (se usa inline; tier_price = case v_tier ...)

  -- (1) Resolver la casa COTIZADA.
  if p_target_variant_code is not null then
    select hc.sku, hc.style_name, hc.costo_no_financiable_usd,
           (case v_tier when 'lista' then hc.precio_lista_usd
                        when 'pozo'  then hc.precio_pozo_usd
                        else hc.precio_contado_usd end)
      into v_sku, v_style, v_nofin, v_tier_price
      from public.house_catalog hc
     where hc.sku = p_target_variant_code
       and lower(trim(coalesce(hc.status,'active'))) = 'active'
     limit 1;
  end if;

  if v_sku is null then
    -- (1b) sin target (o target inexistente): la MÁS CARA financiable.
    select hc.sku, hc.style_name, hc.costo_no_financiable_usd, tp.tier_price
      into v_sku, v_style, v_nofin, v_tier_price
      from public.house_catalog hc
      cross join lateral (select (case v_tier when 'lista' then hc.precio_lista_usd
                                              when 'pozo'  then hc.precio_pozo_usd
                                              else hc.precio_contado_usd end) as tier_price) tp
     where lower(trim(coalesce(hc.status,'active'))) = 'active'
       and hc.brand = 'HAUSIND'
       and tp.tier_price is not null
       and ( (tp.tier_price + v_lot - v_funds) <= 0
             or ( (tp.tier_price + v_lot - v_funds) <= (tp.tier_price - coalesce(hc.costo_no_financiable_usd,0))
                  and (tp.tier_price + v_lot - v_funds) <= v_headroom ) )
     order by tp.tier_price desc
     limit 1;
  end if;

  if v_sku is null then
    -- (1c) ninguna financiable: la MÁS BARATA (gap honesto).
    select hc.sku, hc.style_name, hc.costo_no_financiable_usd, tp.tier_price
      into v_sku, v_style, v_nofin, v_tier_price
      from public.house_catalog hc
      cross join lateral (select (case v_tier when 'lista' then hc.precio_lista_usd
                                              when 'pozo'  then hc.precio_pozo_usd
                                              else hc.precio_contado_usd end) as tier_price) tp
     where lower(trim(coalesce(hc.status,'active'))) = 'active'
       and hc.brand = 'HAUSIND' and tp.tier_price is not null
     order by tp.tier_price asc
     limit 1;
  end if;

  -- (2) Cálculo para la casa cotizada.
  v_sale   := coalesce(v_tier_price,0) + v_lot;
  v_margin := greatest(0, coalesce(v_tier_price,0) - coalesce(v_nofin,0));   -- lote se cancela
  v_gap    := greatest(0, v_sale - v_funds);
  v_fin    := (v_gap <= 0) or (v_gap <= v_margin and v_gap <= v_headroom);
  v_gap_pct := case when v_sale > 0 then round((v_gap / v_sale) * 100.0, 2) else null end;
  v_sold   := greatest(0, v_cq_total - v_cq_avail);
  v_until  := greatest(0, coalesce(v_proj.minimum_units_to_start,0) - v_sold);

  return query select
    v_proj.id, v_proj.project_slug,
    round(v_sale,2), round(v_sale,2), round(v_funds,2),
    round(v_gap,2), round(v_gap,2), v_gap_pct,
    round(v_cq_pool,2), round(v_committed,2), round(v_headroom,2),
    round(coalesce(v_proj.minimum_units_to_start,0) * coalesce(v_nofin,0), 2),
    (v_cq_pool >= coalesce(v_proj.minimum_units_to_start,0) * coalesce(v_nofin,0)),
    v_fin, v_fin,
    v_proj.minimum_units_to_start, v_cq_total, v_cq_avail, v_sold, v_until,
    'v4-target-nofin'::text,
    v_sku, v_style, v_tier, round(v_margin,2);
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT). Ajustar 'posadas-rio' si hace falta.
-- -----------------------------------------------------------------------------
-- A) SIN target, fondos altos → debe cotizar una casa CARA (no la más barata).
select 'A no-target, fondos altos' chk, resolved_sku, resolved_style, reference_sale_price_usd,
       funding_gap_ref_usd, gap_financeable_ref, margin_financiable_usd
  from public.evaluate_project_affordability('posadas-rio', 200000, 60000, 0, null, 'contado');

-- B) CON target explícito → cotiza ESA casa (gap de esa, no de la más barata).
select 'B target explícito' chk, resolved_sku, reference_sale_price_usd, funding_gap_ref_usd, gap_financeable_ref
  from public.evaluate_project_affordability('posadas-rio', 120000, 20000, 0,
       (select sku from public.house_catalog where brand='HAUSIND' and status='active'
        order by precio_contado_usd desc limit 1), 'contado');

-- C) Fondos bajos, sin target → cae a la MÁS BARATA con gap honesto.
select 'C fondos bajos' chk, resolved_sku, reference_sale_price_usd, funding_gap_ref_usd, gap_financeable_ref
  from public.evaluate_project_affordability('posadas-rio', 20000, 5000, 0, null, 'contado');

-- D) Tier importa: misma casa en lista vs pozo cambia precio y margen.
select 'D tier lista' chk, resolved_sku, reference_sale_price_usd, margin_financiable_usd
  from public.evaluate_project_affordability('posadas-rio', 300000, 50000, 0, null, 'lista');

commit;
-- rollback;  -- si algo no cuadra

-- =============================================================================
-- DOWN (manual): recrear la firma de 5 args desde 0068 si hace falta revertir.
-- =============================================================================

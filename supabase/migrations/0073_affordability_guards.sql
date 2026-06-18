-- =============================================================================
-- 0073 — evaluate_project_affordability v5: guards anti "financeable=true" falso.
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit, mirar VERIFICACIÓN.
--
-- Cierra los hallazgos HIGH/MEDIUM de la auditoría sobre 0071:
--   (1) PISO NULL → fail-safe: si costo_no_financiable es NULL, margen = 0 (antes
--       coalesce(...,0) hacía margen = casa entera → financiaba el 100%). Ahora
--       coalesce(v_nofin, v_tier_price) → margen 0 → solo financiable si gap<=0.
--       Además el branch most-expensive EXIGE floor not null (no elige casas sin piso).
--   (2) FILTRO DE MARCA en el branch de target (antes faltaba → una 2da marca sin
--       piso era cotizable). Y normaliza upper(trim(sku)).
--   (3) TARGET INEXISTENTE → calc_version 'v5-target-not-found' + financiable false
--       (antes sustituía OTRA casa en silencio y devolvía financeable para esa).
--   (4) SCOPE DE ÁREA: +p_max_area_m2 → no cotiza una casa fuera del tope de la línea
--       (ej. ADUS ~90m²). Default null = sin tope (backward-compatible).
--
-- (LTV / max_financing_pct queda para una migración aparte: la cap depende del
--  precio de la casa resuelta y conviene atarla con la definición de los contadores.)
-- =============================================================================
begin;

drop function if exists public.evaluate_project_affordability(text, numeric, numeric, numeric, text, text);

create or replace function public.evaluate_project_affordability(
  p_project_slug        text,
  p_bank_loan_usd       numeric,
  p_savings_usd         numeric,
  p_client_equity_usd   numeric default 0,
  p_target_variant_code text    default null,
  p_price_tier          text    default 'contado',
  p_max_area_m2         numeric default null      -- NEW: tope de área de la línea (ADUS ~90)
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
  v_target_requested boolean;
  v_calc text;
begin
  v_tier  := case lower(coalesce(p_price_tier,'contado'))
               when 'lista' then 'lista' when 'pozo' then 'pozo' else 'contado' end;
  v_funds := coalesce(p_bank_loan_usd,0) + coalesce(p_savings_usd,0) + coalesce(p_client_equity_usd,0);
  v_target_requested := (p_target_variant_code is not null and length(trim(p_target_variant_code)) > 0);

  select * into v_proj from public.projects p
   where p.project_slug = p_project_slug and p.is_active is distinct from false limit 1;
  if not found then
    return query select null::uuid, p_project_slug, null::numeric,null::numeric,v_funds,
      null::numeric,null::numeric,null::numeric,null::numeric,null::numeric,null::numeric,null::numeric,
      false,false,false,null::int,null::int,null::int,null::int,null::int,
      'v5-project-not-found'::text, null::text,null::text,v_tier,null::numeric;
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

  -- (1) target explícito: marca + normalizado.
  if v_target_requested then
    select hc.sku, hc.style_name, hc.costo_no_financiable_usd,
           (case v_tier when 'lista' then hc.precio_lista_usd
                        when 'pozo'  then hc.precio_pozo_usd
                        else hc.precio_contado_usd end)
      into v_sku, v_style, v_nofin, v_tier_price
      from public.house_catalog hc
     where upper(trim(hc.sku)) = upper(trim(p_target_variant_code))
       and hc.brand = 'HAUSIND'
       and lower(trim(coalesce(hc.status,'active'))) = 'active'
     limit 1;

    -- (3) target pedido pero NO encontrado → no sustituir; devolver flag.
    if v_sku is null then
      return query select v_proj.id, v_proj.project_slug, null::numeric,null::numeric,round(v_funds,2),
        null::numeric,null::numeric,null::numeric, round(v_cq_pool,2),round(v_committed,2),round(v_headroom,2),
        null::numeric, false, false, false,
        v_proj.minimum_units_to_start, v_cq_total, v_cq_avail,
        greatest(0,v_cq_total-v_cq_avail), greatest(0,coalesce(v_proj.minimum_units_to_start,0)-(v_cq_total-v_cq_avail)),
        'v5-target-not-found'::text, p_target_variant_code, null::text, v_tier, null::numeric;
      return;
    end if;
  end if;

  -- (1b) sin target: la MÁS CARA financiable (con piso y dentro del tope de área).
  if v_sku is null then
    select hc.sku, hc.style_name, hc.costo_no_financiable_usd, tp.tier_price
      into v_sku, v_style, v_nofin, v_tier_price
      from public.house_catalog hc
      cross join lateral (select (case v_tier when 'lista' then hc.precio_lista_usd
                                              when 'pozo'  then hc.precio_pozo_usd
                                              else hc.precio_contado_usd end) as tier_price) tp
     where lower(trim(coalesce(hc.status,'active'))) = 'active'
       and hc.brand = 'HAUSIND'
       and hc.costo_no_financiable_usd is not null                      -- (1) no casas sin piso
       and tp.tier_price is not null
       and (p_max_area_m2 is null or hc.area_m2 <= p_max_area_m2)        -- (4) tope de área
       and ( (tp.tier_price + v_lot - v_funds) <= 0
             or ( (tp.tier_price + v_lot - v_funds) <= (tp.tier_price - hc.costo_no_financiable_usd)
                  and (tp.tier_price + v_lot - v_funds) <= v_headroom ) )
     order by tp.tier_price desc
     limit 1;
  end if;

  -- (1c) ninguna financiable: la MÁS BARATA dentro del tope de área (gap honesto).
  if v_sku is null then
    select hc.sku, hc.style_name, hc.costo_no_financiable_usd, tp.tier_price
      into v_sku, v_style, v_nofin, v_tier_price
      from public.house_catalog hc
      cross join lateral (select (case v_tier when 'lista' then hc.precio_lista_usd
                                              when 'pozo'  then hc.precio_pozo_usd
                                              else hc.precio_contado_usd end) as tier_price) tp
     where lower(trim(coalesce(hc.status,'active'))) = 'active'
       and hc.brand = 'HAUSIND' and tp.tier_price is not null
       and (p_max_area_m2 is null or hc.area_m2 <= p_max_area_m2)
     order by tp.tier_price asc
     limit 1;
  end if;

  -- (2) Cálculo. NULL floor → fail-safe: coalesce(v_nofin, v_tier_price) → margen 0.
  v_sale   := coalesce(v_tier_price,0) + v_lot;
  v_margin := greatest(0, coalesce(v_tier_price,0) - coalesce(v_nofin, v_tier_price));
  v_gap    := greatest(0, v_sale - v_funds);
  v_fin    := (v_gap <= 0) or (v_gap <= v_margin and v_gap <= v_headroom);
  v_gap_pct := case when v_sale > 0 then round((v_gap / v_sale) * 100.0, 2) else null end;
  v_sold   := greatest(0, v_cq_total - v_cq_avail);
  v_until  := greatest(0, coalesce(v_proj.minimum_units_to_start,0) - v_sold);
  v_calc   := case when v_nofin is null then 'v5-missing-floor' else 'v5-guarded' end;

  return query select
    v_proj.id, v_proj.project_slug,
    round(v_sale,2), round(v_sale,2), round(v_funds,2),
    round(v_gap,2), round(v_gap,2), v_gap_pct,
    round(v_cq_pool,2), round(v_committed,2), round(v_headroom,2),
    round(coalesce(v_proj.minimum_units_to_start,0) * coalesce(v_nofin,0), 2),
    (v_cq_pool >= coalesce(v_proj.minimum_units_to_start,0) * coalesce(v_nofin,0)),
    v_fin, v_fin,
    v_proj.minimum_units_to_start, v_cq_total, v_cq_avail, v_sold, v_until,
    v_calc, v_sku, v_style, v_tier, round(v_margin,2);
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT).
-- -----------------------------------------------------------------------------
-- A) sin target, fondos altos → cotiza caro (igual que 0071), calc_version v5-guarded.
select 'A no-target' chk, resolved_sku, reference_sale_price_usd, gap_financeable_ref, calc_version
  from public.evaluate_project_affordability('posadas-rio', 200000, 60000, 0, null, 'contado');

-- B) target INEXISTENTE → v5-target-not-found, NO sustituye, financeable false.
select 'B target trucho' chk, resolved_sku, gap_financeable_ref, calc_version
  from public.evaluate_project_affordability('posadas-rio', 200000, 60000, 0, 'SKU-QUE-NO-EXISTE', 'contado');

-- C) tope de área 90m² con fondos altos → NO debe cotizar casas grandes (>90m²).
select 'C area<=90' chk, resolved_sku, reference_sale_price_usd, calc_version
  from public.evaluate_project_affordability('posadas-rio', 300000, 80000, 0, null, 'contado', 90);

-- D) target real (más caro) con trim/case → resuelve igual.
select 'D target normalizado' chk, resolved_sku, calc_version
  from public.evaluate_project_affordability('posadas-rio', 500000, 100000, 0,
       lower('  ' || (select sku from public.house_catalog where brand='HAUSIND' and status='active'
                      order by precio_contado_usd desc limit 1) || '  '), 'contado');

commit;
-- rollback;

-- =============================================================================
-- DOWN (manual): recrear la firma de 6 args desde 0071.
-- =============================================================================

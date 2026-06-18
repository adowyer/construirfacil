-- =============================================================================
-- 0086 — Pool dinámico + cupo a nivel proyecto (Posadas)
--
-- ⚠️ DRAFT para revisar por Andrea. (Renumerada desde 0068 al próximo libre tras 0085.)
--
-- Qué arregla (validado por auditoría Backend + tu Esquema_Financiero.md):
--   (1) MARGEN: usaba `pozo − costo − lote` (≈0). Pasa a `lista − costo` (sin restar lote).
--       Tu decisión fue LISTA. Nota: el experto sugirió CONTADO (los compradores del cupo pagan
--       el precio contado/CUPO, no lista) → más conservador. Si querés contado, cambiá la línea marcada.
--   (2) POOL: dejaba de COMPUTAR `min_units × margen` (teórico) y LEE el saldo guardado
--       `construction_quotas.margin_pool_usd` (dinámico: crece con cierres al contado). Hoy = 0.
--   (3) GATE: elimina `pool_ok := margin_pool >= min_units×costo` (pedía cubrir 25× construcción —
--       absurdo para prestar GAPS). Ahora `gap_financeable := gap<=0 OR gap<=headroom`.
--   (4) CUPO: la función busca el cupo por project_id, pero el seed (0051) lo creó por
--       (marca×provincia) con project_id NULL → invisible. Sembramos el cupo PROPIO de Posadas.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- (4) Cupo a nivel PROYECTO para Posadas (25 slots, pool arranca en 0).
--     ⚠️ Verificá los nombres de columna de marcas/provincias (no los tengo a mano).
-- -----------------------------------------------------------------------------
insert into public.construction_quotas
  (project_id, marca_id, provincia_id, quota_code, total_slots, available_slots, margin_pool_usd, status, start_month)
select p.id, m.id, prov.id, 'POSADAS-RIO-C1', 25, 25, 0, 'open', date '2026-06-01'
from public.projects p
cross join public.marcas m
cross join public.provincias prov
where p.project_slug = 'posadas-rio'
  and m.name ilike 'hausind'            -- marcas.name (confirmado por el error 42703)
  and prov.slug = 'misiones'            -- provincias.slug (usado en evaluate_property_options)
on conflict (quota_code) do nothing;

-- -----------------------------------------------------------------------------
-- (1)(2)(3) Función con la matemática del pool corregida.
--     Reproduce tu función viva con SOLO los cambios marcados (-- CHANGE).
-- -----------------------------------------------------------------------------
create or replace function public.evaluate_project_affordability(
  p_project_slug        text,
  p_bank_loan_usd       numeric,
  p_savings_usd         numeric,
  p_client_equity_usd   numeric default 0,
  p_target_variant_code text    default null
)
returns table (
  project_id uuid, project_slug text,
  reference_sale_price_usd numeric, target_sale_price_usd numeric, total_funds_usd numeric,
  funding_gap_ref_usd numeric, funding_gap_target_usd numeric, gap_pct_ref numeric,
  margin_pool_usd numeric, private_committed_usd numeric, private_headroom_usd numeric,
  construction_quota_required_usd numeric, pool_covers_construction boolean,
  gap_financeable_ref boolean, gap_financeable_target boolean,
  minimum_units_to_start integer, quota_total_slots integer, quota_available_slots integer,
  units_sold_in_quota integer, units_until_obra_start integer, calc_version text
)
language plpgsql
as $$
DECLARE
  v_proj public.projects%ROWTYPE;
  v_lot_usd numeric; v_cheapest record; v_target record;
  v_ref_sale numeric; v_tgt_sale numeric; v_eff_ref numeric; v_eff_tgt numeric;
  v_margin_unit numeric; v_margin_pool numeric; v_committed numeric; v_headroom numeric;
  v_n integer; v_con_req numeric;
  v_cq_total integer; v_cq_avail integer; v_cq_pool numeric;   -- CHANGE: +v_cq_pool (saldo guardado)
  v_sold integer; v_until integer;
  v_funds numeric; v_gap_ref numeric; v_gap_tgt numeric; v_gap_pct numeric;
  v_pool_ok boolean; v_fin_ref boolean; v_fin_tgt boolean;
BEGIN
  SELECT * INTO v_proj FROM public.projects p
   WHERE p.project_slug = p_project_slug AND p.is_active IS DISTINCT FROM false LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, p_project_slug,
      NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,
      NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,NULL::boolean,NULL::boolean,NULL::boolean,
      NULL::integer,NULL::integer,NULL::integer,NULL::integer,NULL::integer,'v1-project-not-found'::text;
    RETURN;
  END IF;

  SELECT min(l.price_usd) INTO v_lot_usd
    FROM public.lots_inventory l
   WHERE l.project_id = v_proj.id AND lower(trim(l.status)) = 'available';   -- CHANGE: case-insensitive
  v_lot_usd := coalesce(v_lot_usd, 0);

  SELECT hc.id, hc.sku AS variant_code, hc.precio_lista_usd AS public_price_usd,
         hc.costo_plano_usd AS construction_cost_usd,
         COALESCE(ROUND(((hc.precio_lista_usd - hc.precio_pozo_usd)/NULLIF(hc.precio_lista_usd,0))*100.0,2),0) AS presale_discount_pct
    INTO v_cheapest
    FROM public.house_catalog hc
   WHERE lower(trim(coalesce(hc.status,'active'))) = 'active' AND hc.precio_lista_usd IS NOT NULL
   ORDER BY hc.precio_lista_usd ASC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT v_proj.id, v_proj.project_slug, NULL::numeric, NULL::numeric,
      coalesce(p_savings_usd,0)+coalesce(p_bank_loan_usd,0)+coalesce(p_client_equity_usd,0),
      NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,NULL::numeric,
      false,false,false, v_proj.minimum_units_to_start, NULL::integer,NULL::integer,NULL::integer,NULL::integer,
      'v1-no-catalog'::text;
    RETURN;
  END IF;

  -- Cupo PROPIO del proyecto (slots + saldo guardado del pool).         -- CHANGE: leer margin_pool_usd
  SELECT coalesce(cq.total_slots,0), coalesce(cq.available_slots,0), coalesce(cq.margin_pool_usd,0)
    INTO v_cq_total, v_cq_avail, v_cq_pool
    FROM public.construction_quotas cq
   WHERE cq.project_id = v_proj.id AND lower(trim(coalesce(cq.status,'open'))) = 'open'
   ORDER BY cq.created_at DESC NULLS LAST LIMIT 1;

  v_eff_ref  := coalesce(v_cheapest.public_price_usd,0) * (1.0 - (coalesce(v_cheapest.presale_discount_pct,0)/100.0));
  v_ref_sale := v_eff_ref + v_lot_usd;   -- casa+lote se vende a precio pozo + lote (OK, sin cambio)

  -- CHANGE (1): margen = LISTA − costo de obra (sin pozo, sin restar lote).
  --   Para CONTADO (más conservador): usar v_cheapest... precio_contado_usd. Ver nota arriba.
  v_margin_unit := greatest(0, coalesce(v_cheapest.public_price_usd,0) - coalesce(v_cheapest.construction_cost_usd,0));

  v_n := greatest(coalesce(v_proj.minimum_units_to_start,0),0);
  v_margin_pool := coalesce(v_cq_pool, 0);                 -- CHANGE (2): POOL = saldo guardado (dinámico), no min_units×margen
  v_con_req := v_n * coalesce(v_cheapest.construction_cost_usd,0);

  SELECT coalesce(sum(pfc.amount_usd_committed),0) INTO v_committed
    FROM public.private_financing_commitments pfc
   WHERE pfc.project_id = v_proj.id AND pfc.status = ANY (ARRAY['pending'::text,'confirmed'::text]);

  v_headroom := greatest(0, coalesce(v_margin_pool,0) - coalesce(v_committed,0));
  v_pool_ok  := coalesce(v_margin_pool,0) >= coalesce(v_con_req,0);   -- se mantiene SOLO como indicador informativo

  -- target model
  IF p_target_variant_code IS NOT NULL AND length(trim(p_target_variant_code)) > 0 THEN
    SELECT hc.precio_lista_usd AS public_price_usd, hc.costo_plano_usd AS construction_cost_usd,
           COALESCE(ROUND(((hc.precio_lista_usd - hc.precio_pozo_usd)/NULLIF(hc.precio_lista_usd,0))*100.0,2),0) AS presale_discount_pct
      INTO v_target FROM public.house_catalog hc
     WHERE hc.sku = trim(p_target_variant_code) AND lower(trim(coalesce(hc.status,'active')))='active' LIMIT 1;
    IF FOUND THEN
      v_eff_tgt := coalesce(v_target.public_price_usd,0) * (1.0 - (coalesce(v_target.presale_discount_pct,0)/100.0));
      v_tgt_sale := v_eff_tgt + v_lot_usd;
    ELSE v_tgt_sale := v_ref_sale; END IF;
  ELSE v_tgt_sale := v_ref_sale; END IF;

  v_funds   := coalesce(p_savings_usd,0) + coalesce(p_bank_loan_usd,0) + coalesce(p_client_equity_usd,0);
  v_gap_ref := greatest(0, coalesce(v_ref_sale,0) - v_funds);
  v_gap_tgt := greatest(0, coalesce(v_tgt_sale,0) - v_funds);
  v_gap_pct := case when coalesce(v_ref_sale,0) > 0 then round((v_gap_ref/v_ref_sale)*100.0,2) else null end;

  -- CHANGE (3): el pool presta GAPS → solo importa si hay headroom para ESTE gap. Sin el gate pool_ok.
  v_fin_ref := case when v_gap_ref <= 0 then true else v_gap_ref <= coalesce(v_headroom,0) end;
  v_fin_tgt := case when v_gap_tgt <= 0 then true else v_gap_tgt <= coalesce(v_headroom,0) end;

  v_sold  := greatest(0, coalesce(v_cq_total,0) - coalesce(v_cq_avail,0));
  v_until := greatest(0, coalesce(v_proj.minimum_units_to_start,0) - v_sold);

  RETURN QUERY SELECT
    v_proj.id, v_proj.project_slug, round(v_ref_sale,2), round(v_tgt_sale,2), round(v_funds,2),
    round(v_gap_ref,2), round(v_gap_tgt,2), v_gap_pct, round(coalesce(v_margin_pool,0),2),
    round(coalesce(v_committed,0),2), round(coalesce(v_headroom,0),2), round(coalesce(v_con_req,0),2),
    coalesce(v_pool_ok,false), coalesce(v_fin_ref,false), coalesce(v_fin_tgt,false),
    v_proj.minimum_units_to_start, v_cq_total, v_cq_avail, v_sold, v_until, 'v3-pool-dynamic'::text;
END;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT)
-- -----------------------------------------------------------------------------
-- A) Pool LEÍDO del cupo (hoy 0) → gap>0 NO financeable (honesto en lanzamiento), gap=0 sí.
select 'pool dinámico' chk, project_slug, margin_pool_usd, private_headroom_usd, calc_version,
       funding_gap_ref_usd, gap_financeable_ref
  from public.evaluate_project_affordability('posadas-rio', 50000, 20000, 0, NULL);  -- fuerza gap

-- B) Simulá un cierre al contado: cargá el pool y reconfirmá que ahora SÍ cubre el gap.
--    (NO commitees esta línea de prueba — es solo para ver el mecanismo)
-- update public.construction_quotas set margin_pool_usd = 25000 where quota_code='POSADAS-RIO-C1';
-- select 'pool con 25k' chk, margin_pool_usd, private_headroom_usd, gap_financeable_ref
--   from public.evaluate_project_affordability('posadas-rio', 50000, 20000, 0, NULL);
-- update public.construction_quotas set margin_pool_usd = 0 where quota_code='POSADAS-RIO-C1';  -- revertir prueba

-- C) Caso viable (crédito alto) sigue dando gap 0 → financeable true.
select 'viable' chk, funding_gap_ref_usd, gap_financeable_ref
  from public.evaluate_project_affordability('posadas-rio', 178571, 28571, 0, NULL);

commit;
-- rollback;  -- si algo no cuadra

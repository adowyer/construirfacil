-- =============================================================================
-- qualify_leads.sql — Califica leads con el motor (doble escenario) y los bucketea.
-- PROCESO repetible de Fase 0 (correr cuando entra una tanda de leads).
-- Requiere: 0074 (leads enriquecida) + 0079 (columnas ADUS-con-lote). Read/write a leads.
--
-- Doble escenario por lead:
--   • AHORA  (has_lot real): a qué crédito accede HOY → loan_usd, monthly_payment_ars.
--   • CON LOTE (has_lot=true): ¿calificaría para ADUS (Neuquén Habita, UVI+2%) si tuviera
--     tierra? → qualifies_adus_with_lot + adus_loan_with_lot_usd.
--
-- El flag ADUS-con-lote NO es UOCRA-específico: marca a CUALQUIER lead que cumple todo ADUS
-- y solo le falta el lote → segmento "demanda lista, sin tierra" = palanca para negociar
-- tierra (UOCRA / Provincia / privados). Ver el RADAR al final.
-- =============================================================================
begin;

with fx as (select value::numeric rate from public.system_config where key='usd_exchange_rate'),
casa_min as (select min(precio_contado_usd) usd from public.house_catalog where brand ilike 'hausind'),
now_best as (   -- escenario AHORA: con su has_lot real (null→false, conservador)
  select distinct on (l.id) l.id lead_id, e.bank_name, e.product_name,
         e.loan_possible_usd loan_usd, e.monthly_payment_ars
  from public.leads l
  cross join lateral public.evaluate_property_options(
    coalesce(l.savings_amount,0), l.monthly_income_ars, 2, 'primera_vivienda', l.province,
    l.residency_years, coalesce(l.employment_type,'self_employed_simplified'),
    coalesce(l.savings_currency,'ARS'), coalesce(l.has_lot,false), 'ARS') e
  where l.monthly_income_ars is not null
  order by l.id, e.loan_possible_usd desc
),
adus_lot as (   -- escenario CON LOTE: ¿aparece ADUS?
  select l.id lead_id,
         max(case when e.bank_name='Neuquén Habita' then e.loan_possible_usd end) adus_loan_usd
  from public.leads l
  cross join lateral public.evaluate_property_options(
    coalesce(l.savings_amount,0), l.monthly_income_ars, 2, 'primera_vivienda', l.province,
    l.residency_years, coalesce(l.employment_type,'self_employed_simplified'),
    coalesce(l.savings_currency,'ARS'), true, 'ARS') e
  where l.monthly_income_ars is not null
  group by l.id
)
update public.leads l set
  -- campaña: solo tagueo UOCRA (no piso campañas de otros orígenes)
  campaign_slug = case when l.source='sindicato_uocra' then coalesce(l.campaign_slug,'UOCRA')
                       else l.campaign_slug end,
  loan_usd = round(n.loan_usd),
  monthly_payment_ars = round(n.monthly_payment_ars),
  qualifies = (n.loan_usd is not null and n.loan_usd > 0),
  qualifies_adus_with_lot = (a.adus_loan_usd is not null),
  adus_loan_with_lot_usd = round(a.adus_loan_usd),
  financial_path = case when coalesce(l.has_lot,false) then 'casa_lote_viable' else 'no_loteo' end,
  bucket = case
    when n.loan_usd is null or n.loan_usd <= 0 then 'NOT_A_FIT'
    when coalesce(l.has_lot,false) then 'READY'                 -- tiene lote + crédito
    else 'QUALIFIES_LATER' end,                                  -- crédito OK, falta el lote
  blocker = case
    when n.loan_usd is null or n.loan_usd <= 0 then 'Ingreso insuficiente para crédito'
    when not coalesce(l.has_lot,false) and a.adus_loan_usd is not null
         then 'Falta lote — califica ADUS provincial (UVI 2%)'
    when not coalesce(l.has_lot,false) then 'Falta lote'
    else null end,
  -- distancia / "lo que le falta": income vs el ingreso necesario para la casa más barata
  -- (loan escala lineal con income → needed_income = casa_min × income / loan_now)
  profile_json = coalesce(l.profile_json,'{}'::jsonb) || jsonb_build_object('qualification', jsonb_build_object(
      'best_line_now', n.bank_name||' · '||n.product_name,
      'credit_now_usd', round(n.loan_usd),
      'adus_with_lot_usd', round(a.adus_loan_usd),
      'casa_mas_barata_usd', (select round(usd) from casa_min),
      'cubre_casa_min', n.loan_usd >= (select usd from casa_min),
      'income_needed_casa_min_ars', case when n.loan_usd>0
          then round((select usd from casa_min) * l.monthly_income_ars / n.loan_usd) end,
      'income_distance_ars', case when n.loan_usd>0
          then round(l.monthly_income_ars - (select usd from casa_min) * l.monthly_income_ars / n.loan_usd) end
    )),
  updated_at = now()
from now_best n
left join adus_lot a on a.lead_id = n.lead_id
where l.id = n.lead_id;

-- -----------------------------------------------------------------------------
-- ⚔️  RADAR: demanda lista para ADUS sin tierra (palanca de negociación de tierra)
--    Cortado por campaña × provincia (rollup → subtotales + total general).
-- -----------------------------------------------------------------------------
select coalesce(campaign_slug,'(sin campaña)') campaña, coalesce(province,'(s/prov)') provincia,
       count(*) pre_calificados_adus,
       round(sum(adus_loan_with_lot_usd)) credito_adus_total_usd,
       round(avg(monthly_income_ars)) ingreso_prom_ars
from public.leads
where qualifies_adus_with_lot and coalesce(has_lot,false)=false
group by rollup (campaign_slug, province)
order by pre_calificados_adus desc nulls last;

-- -----------------------------------------------------------------------------
-- 📋  Follow-up: por lead — qué tiene, qué le falta, cuán lejos
-- -----------------------------------------------------------------------------
select name, campaign_slug campaña, monthly_income_ars ingreso,
       loan_usd credito_hoy_usd, adus_loan_with_lot_usd credito_con_lote_usd,
       (profile_json->'qualification'->>'income_distance_ars')::numeric dist_ingreso_ars,
       bucket, blocker,
       case when profile_json ? 'needs_review' then '⚠️' else '' end revisar
from public.leads
where source='sindicato_uocra'
order by adus_loan_with_lot_usd desc nulls last;

commit;
-- rollback;

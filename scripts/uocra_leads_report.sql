-- uocra_leads_report.sql
-- Reporte + export de los leads UOCRA con sus resultados.
-- Andrea: corré PARTE 1 y exportá a CSV (ese es el "file"); PARTE 2 son los conteos.
-- ⚠️ Los RESULTADOS tienen PII (Ley 25.326) → quedan en tu export local, NUNCA al repo.
-- ⚠️ NO incluyo la cuota mensual: su cálculo tiene el fix pendiente de aprobación de los SH.
--    El crédito (loan_usd) SÍ es correcto (sale del préstamo máximo, ya validado).

-- ============================================================================
-- PARTE 1 — EXPORT DETALLE (una fila por lead). Exportá ESTO a CSV.
-- ============================================================================
select
  l.name                                                          as nombre,
  l.dni, l.cuil, l.phone as telefono, l.email,
  l.province                                                      as provincia,
  l.monthly_income_ars                                            as ingreso_mensual_ars,
  l.savings_amount                                                as ahorro,
  l.savings_currency                                              as ahorro_moneda,
  case when l.has_lot then 'Sí' when l.has_lot = false then 'No' else '—' end          as tiene_lote,
  case when l.qualifies then 'Sí' when l.qualifies = false then 'No' else '—' end      as califica,
  l.bucket,
  l.loan_usd                                                      as credito_usd,
  case when l.qualifies_adus_with_lot then 'Sí' else 'No' end     as califica_adus_con_lote,
  l.adus_loan_with_lot_usd                                        as credito_con_lote_usd,
  l.blocker                                                       as bloqueo,
  case when l.consent_captured_at is not null then 'Sí' else 'No' end as consentimiento,
  case when l.first_home then 'Sí' when l.first_home = false then 'No' else '—' end     as primera_vivienda,
  l.residency_years                                               as anos_residencia,
  l.employment_type                                               as empleo,
  l.delegado, l.seccional
from public.leads l
where l.source = 'sindicato_uocra'
order by (l.qualifies is true) desc, l.loan_usd desc nulls last;

-- ============================================================================
-- PARTE 2 — RESUMEN (tus preguntas)
-- ============================================================================

-- (a) ¿Cuántos califican? ¿A qué crédito?
select
  count(*)                                          as total_uocra,
  count(*) filter (where qualifies)                 as califican,
  count(*) filter (where qualifies = false)         as no_califican,
  count(*) filter (where qualifies is null)         as sin_evaluar,
  round(avg(loan_usd) filter (where qualifies))     as credito_prom_usd,
  round(min(loan_usd) filter (where qualifies))     as credito_min_usd,
  round(max(loan_usd) filter (where qualifies))     as credito_max_usd,
  round(sum(loan_usd) filter (where qualifies))     as credito_total_usd
from public.leads where source = 'sindicato_uocra';

-- (a.2) Distribución del crédito por tramo (USD), entre los que califican
select
  case when loan_usd < 50000  then '1) < 50k'
       when loan_usd < 75000  then '2) 50–75k'
       when loan_usd < 100000 then '3) 75–100k'
       else                        '4) 100k+' end as tramo_credito_usd,
  count(*) as leads
from public.leads
where source = 'sindicato_uocra' and qualifies
group by 1 order by 1;

-- (b) ¿Cuántos tienen lote?
select
  count(*) filter (where has_lot)          as con_lote,
  count(*) filter (where has_lot = false)  as sin_lote,
  count(*) filter (where has_lot is null)  as lote_desconocido
from public.leads where source = 'sindicato_uocra';

-- (c) Ingresos
select
  count(*) filter (where monthly_income_ars is not null) as con_ingreso,
  round(avg(monthly_income_ars))                          as ingreso_prom_ars,
  round(min(monthly_income_ars))                          as ingreso_min_ars,
  round(max(monthly_income_ars))                          as ingreso_max_ars
from public.leads where source = 'sindicato_uocra';

-- (d) Ahorros (cuántos tienen y montos). OJO: ahorro_moneda mezcla ARS/USD
--     (ver columna en el detalle). Acá cuento "tiene ahorro" = monto > 0.
select
  count(*) filter (where coalesce(savings_amount,0) > 0)  as con_ahorro,
  count(*) filter (where coalesce(savings_amount,0) = 0)  as sin_ahorro,
  round(avg(savings_amount) filter (where coalesce(savings_amount,0) > 0)) as ahorro_prom,
  round(max(savings_amount) filter (where coalesce(savings_amount,0) > 0)) as ahorro_max
from public.leads where source = 'sindicato_uocra';

-- (e) NO tienen lote PERO tienen ahorros — conteo + detalle
select count(*) as sin_lote_con_ahorro
from public.leads
where source = 'sindicato_uocra' and has_lot = false and coalesce(savings_amount,0) > 0;

select l.name as nombre, l.dni, l.monthly_income_ars as ingreso, l.savings_amount as ahorro,
       l.savings_currency as moneda, l.loan_usd as credito_usd, l.bucket
from public.leads l
where l.source = 'sindicato_uocra' and l.has_lot = false and coalesce(l.savings_amount,0) > 0
order by l.savings_amount desc;

-- (f) Tienen lote Y ahorros — conteo + detalle
select count(*) as con_lote_y_ahorro
from public.leads
where source = 'sindicato_uocra' and has_lot = true and coalesce(savings_amount,0) > 0;

select l.name as nombre, l.dni, l.monthly_income_ars as ingreso, l.savings_amount as ahorro,
       l.savings_currency as moneda, l.loan_usd as credito_usd, l.bucket
from public.leads l
where l.source = 'sindicato_uocra' and l.has_lot = true and coalesce(l.savings_amount,0) > 0
order by l.savings_amount desc;

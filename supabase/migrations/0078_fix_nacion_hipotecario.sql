-- =============================================================================
-- 0078 — Corrige Banco Nación (TNA 6/12, RCI 0,25, LTV 90, tope solo por UVA) +
--        Banco Hipotecario UVA (TNA 12,5).
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit, mirar verificación.
--
-- Por qué (confirmado contra el oficial BNA + la planilla):
--   • Nación tenía TNA 4,5/8 en la DB → debe ser 6% (1ª ≤210k UVAs) / 12% (2ª/>210k).
--   • Nación RCI: 0,25 (el calculador BNA lo confirma; sin info oficial de dep/auto → único).
--   • Nación LTV: 90% (en modular el presupuesto de obra ≈ valor terminado; sin "menor de dos").
--   • Nación tope: SOLO por UVA (157.500 / 260.000 de 0077). Limpiamos max_loan_amount_ars
--     (estaba 250M en pesos → topeaba por debajo del tope real en UVAs).
--   • Hipotecario UVA: TNA 9,5 (DB) → 12,5 (planilla).
-- =============================================================================
begin;

-- Banco Hipotecario · Hipotecario UVA: TNA 12,5 + plazo 180 (planilla)
update public.banks_financing set interest_rate = 12.5, max_term_months = 180
 where bank_name='Banco Hipotecario' and product_name='Hipotecario UVA';

-- Banco Hipotecario · Personal Construcción: tope 70M → 90M (planilla)
update public.banks_financing set max_loan_amount_ars = 90000000
 where bank_name='Banco Hipotecario' and product_name='Personal Construcción';

-- Banco Nación · 1ª Vivienda: TNA 6, RCI 0,25, LTV 90, tope solo por UVA
update public.banks_financing set
  interest_rate=6, interest_rate_self_employed=null, rci=0.25, rci_self_employed=null,
  max_financing_pct=90, max_loan_amount_ars=null
 where bank_name='Banco Nación' and product_name='Hipotecario Primera Vivienda';

-- Banco Nación · 2ª Vivienda: TNA 12, RCI 0,25, LTV 90, tope solo por UVA
update public.banks_financing set
  interest_rate=12, interest_rate_self_employed=null, rci=0.25, rci_self_employed=null,
  max_financing_pct=90, max_loan_amount_ars=null
 where bank_name='Banco Nación' and product_name='Hipotecario Segunda Vivienda';

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT)
-- -----------------------------------------------------------------------------
select bank_name, product_name, interest_rate as tna, rci, max_financing_pct as ltv,
       max_loan_amount_ars/1000000 as tope_pesos_mm, max_loan_uvas as tope_uvas, max_term_months as plazo
  from public.banks_financing
 where bank_name in ('Banco Nación','Banco Hipotecario')
 order by bank_name, product_name;

commit;
-- rollback;

-- =============================================================================
-- 0076 — banks_financing: fix QUIRÚRGICO de la tasa ADUS + verificación completa.
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit. MIRAR LA VERIFICACIÓN.
--
-- CONTEXTO (corregido): la DB estaba BIEN (Andrea confirmó contra la tabla oficial BPN:
--   RCI relación de dependencia 30% / autónomo 25% · TNA dep 3,5/8,5 · auto 4,5/9,5).
--   NO se toca BPN ni Nación ni Hipotecario.
--
-- ÚNICO cambio confirmado: ADUS tenía tasa 6 (override stale de 0058) y debe ser 2
--   (planilla Financiación_Bancaria.xlsx + calculador real, UVI + 2%).
--
-- La VERIFICACIÓN al final lista TODAS las líneas con sus valores: sirve para ver el
-- estado vivo y decidir, con bisturí, si falta setear topes/LTV (audit) — sin sobrescribir
-- lo que ya está correcto.
-- =============================================================================
begin;

-- ÚNICO fix: tasa ADUS 6 → 2 (UVI + 2%). (índice ya debería ser UVI; lo reaseguro.)
update public.banks_financing
   set interest_rate = 2,
       interest_adjustment = coalesce(interest_adjustment, 'UVI')
 where bank_name = 'Neuquén Habita' and product_name = 'Crédito Hipotecario ADUS'
   and interest_rate is distinct from 2;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN — el estado VIVO de TODAS las líneas (pegámelo para revisar juntos
-- si falta algún tope / max_financing_pct, sin tocar lo que ya está bien).
-- -----------------------------------------------------------------------------
select bank_name, product_name, destination,
       interest_rate as tna_dep, interest_rate_self_employed as tna_auto, interest_adjustment as indice,
       rci as rci_dep, rci_self_employed as rci_auto,
       max_term_months as plazo, max_financing_pct as ltv,
       max_loan_amount_ars/1000000 as tope_mm,
       max_household_income_ars as ing_max, min_residency_years as resid, max_area_m2 as area_max,
       provincia_id, is_active
  from public.banks_financing
 order by provincia_id nulls first, bank_name, product_name;

commit;
-- rollback;

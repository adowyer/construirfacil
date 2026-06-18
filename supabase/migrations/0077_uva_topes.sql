-- =============================================================================
-- 0077 — Topes en UVAs (Nación) + valor UVA/UVI en config + cap dinámico.
--
-- ⚠️ DRAFT — Andrea: COMPLETÁ uva_value / uvi_value con los valores VIGENTES
--    (se actualizan como usd_exchange_rate). Correr en begin/commit, mirar verificación.
--
-- Por qué: los topes de Nación están en UVAs (157.500 / 260.000), NO en pesos fijos.
--   Un max_loan_amount_ars en pesos se queda viejo apenas cambia la UVA. Guardamos el tope
--   en UVAs + el valor del índice en config → el cap en pesos se computa dinámico.
--   (ADUS y Banco Neuquén siguen con tope en pesos — más simple — vía max_loan_amount_ars.)
-- =============================================================================
begin;

-- (1) Valor del índice en config (como el dólar). Andrea los mantiene al día.
insert into public.system_config (key, value) values
  ('uva_value', '__UVA_VIGENTE__'),   -- ⚠️ ej. '1989.13'
  ('uvi_value', '__UVI_VIGENTE__')    -- ⚠️ valor UVI vigente
on conflict (key) do nothing;

-- (2) Tope en UVAs por línea.
alter table public.banks_financing add column if not exists max_loan_uvas numeric;
comment on column public.banks_financing.max_loan_uvas is
  'Tope del préstamo expresado en UVAs/UVIs (Nación). El cap en pesos = max_loan_uvas × valor del índice (uva_value/uvi_value según interest_adjustment). NULL = topea solo por max_loan_amount_ars.';

update public.banks_financing set max_loan_uvas = 157500
 where bank_name='Banco Nación' and product_name='Hipotecario Primera Vivienda';
update public.banks_financing set max_loan_uvas = 260000
 where bank_name='Banco Nación' and product_name='Hipotecario Segunda Vivienda';

-- (3) Función: agrega el cap dinámico por UVA al LEAST del préstamo.
--     Idéntica a 0072 salvo: lee uva/uvi de config + carga max_loan_uvas/interest_adjustment
--     en elig + un 3er término en el LEAST (marcados con NEW/CHANGE).
drop function if exists public.evaluate_property_options(
    numeric, numeric, integer, text, text, integer, text, text, boolean, text);

create or replace function public.evaluate_property_options(
    savings_usd        numeric,
    monthly_income_ars numeric,
    p_bedrooms         integer,
    p_destination      text,
    p_province         text    default null,
    p_residency_years  integer default null,
    p_employment_type  text    default null,
    p_savings_currency text    default 'USD',
    p_has_lot          boolean default null,
    p_income_currency  text    default 'ARS'
)
returns table (
    bank_name text, product_name text, max_financing_pct numeric, loan_possible_usd numeric,
    loan_term_years integer, monthly_payment_ars numeric, total_budget_usd numeric,
    requirements_text text, max_area_m2 numeric
)
language plpgsql
as $$
declare
    exchange_rate numeric; v_province_id uuid; v_savings_usd numeric; v_income_ars numeric;
    v_uva numeric; v_uvi numeric;     -- NEW
begin
    select value::numeric into exchange_rate from system_config where key='usd_exchange_rate' limit 1;
    if exchange_rate is null then raise exception 'Missing usd_exchange_rate in system_config'; end if;
    select value::numeric into v_uva from system_config where key='uva_value' limit 1;   -- NEW
    select value::numeric into v_uvi from system_config where key='uvi_value' limit 1;   -- NEW

    v_savings_usd := coalesce(savings_usd,0);
    if upper(coalesce(p_savings_currency,'USD'))='ARS' then v_savings_usd := v_savings_usd/exchange_rate; end if;
    v_income_ars := coalesce(monthly_income_ars,0);
    if upper(coalesce(p_income_currency,'ARS'))='USD' then v_income_ars := v_income_ars*exchange_rate; end if;

    if p_province is not null then
        v_province_id := (select id from public.provincias
            where slug=translate(lower(p_province),'áéíóúñ','aeioun') or name ilike p_province limit 1);
    end if;

    return query
    with elig as (
        select bf.bank_name, bf.product_name, bf.max_financing_pct, bf.max_term_months,
               bf.max_loan_amount_ars, bf.requirements_text, bf.max_area_m2,
               bf.max_loan_uvas, bf.interest_adjustment,            -- NEW
               case when p_employment_type='employed' then bf.interest_rate
                    else coalesce(bf.interest_rate_self_employed, bf.interest_rate) end as eff_rate,
               case when p_employment_type='employed' then coalesce(bf.rci,0.30)
                    else coalesce(bf.rci_self_employed, bf.rci, 0.30) end as eff_rci
        from public.banks_financing bf
        where bf.is_active=true
          and (p_destination is null or bf.destination is null or bf.destination=p_destination
               or (p_destination='primera_vivienda' and bf.destination in ('primera_segunda','vivienda_unica'))
               or (p_destination='segunda_vivienda'  and bf.destination in ('primera_segunda')))
          and (bf.provincia_id is null or bf.provincia_id=v_province_id)
          and (bf.min_residency_years is null or coalesce(p_residency_years,0) >= bf.min_residency_years)
          and (bf.max_household_income_ars is null or v_income_ars <= bf.max_household_income_ars)
          and (coalesce(bf.requires_own_lot,false)=false or coalesce(p_has_lot,true)=true)
    ),
    bank_scenarios as (
        select e.bank_name, e.product_name, e.max_financing_pct, e.max_term_months,
               e.requirements_text, e.max_area_m2, (v_income_ars * e.eff_rci) as monthly_payment_ars,
               LEAST(
                 ( (v_income_ars * e.eff_rci) * (1 - power(1 + ((e.eff_rate/100.0)/12.0), -e.max_term_months))
                   / ((e.eff_rate/100.0)/12.0) ) / exchange_rate,
                 COALESCE(e.max_loan_amount_ars, 999999999999) / exchange_rate,
                 -- NEW: tope en UVAs → pesos (según el índice de la línea) → USD
                 COALESCE(e.max_loan_uvas * (case when upper(coalesce(e.interest_adjustment,'UVA'))='UVI'
                                                  then v_uvi else v_uva end), 999999999999) / exchange_rate
               ) as loan_possible_usd
        from elig e
    )
    select bs.bank_name, bs.product_name, bs.max_financing_pct, ROUND(bs.loan_possible_usd),
           floor(bs.max_term_months/12.0)::integer, ROUND(bs.monthly_payment_ars),
           ROUND(bs.loan_possible_usd + v_savings_usd), bs.requirements_text, bs.max_area_m2
    from bank_scenarios bs
    order by bs.max_financing_pct desc, bs.loan_possible_usd desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT)
-- -----------------------------------------------------------------------------
select 'config índices' chk, key, value from public.system_config where key in ('uva_value','uvi_value','usd_exchange_rate');
select 'topes UVA Nación' chk, product_name, max_loan_uvas from public.banks_financing where max_loan_uvas is not null;
-- Smoke (con uva_value cargado): Nación 1ª debe topear ~157.500 UVAs × uva_value.

commit;
-- rollback;

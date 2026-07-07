-- =============================================================================
-- 0095_consolidate_evaluate_and_fix_cuota.sql
--
-- DOS problemas en public.evaluate_property_options, un solo arreglo:
--
-- 1) OVERLOADS ACUMULADOS ("fuente única" a medias, #20). Las migraciones fueron
--    cambiando la ARIDAD de la función y `create or replace` solo reemplaza si la
--    firma coincide exacta → cada cambio dejó un overload nuevo. Estado vivo hoy:
--      • 10 args (0077): con income_currency + gating has_lot + tope UVA/UVI. La usa
--        qualify_leads (llama con 10 args) → es la CANÓNICA de facto.
--      • 9 args (0085): con gating has_lot, SIN income_currency. Duplicado divergente.
--    Coexisten → llamadas de 9 args dan "function is not unique". Consolidamos:
--    dropeamos las viejas (7/8/9 args) y dejamos SOLO la de 10.
--
-- 2) CUOTA SOBREESTIMADA cuando el préstamo queda TOPEADO. `monthly_payment_ars` se
--    devolvía SIEMPRE como income×rci (techo de capacidad), sin importar qué rama del
--    LEAST ganaba. Si gana un TOPE (pesos o UVA), el préstamo baja pero la cuota
--    quedaba en el techo del préstamo grande → inflada.
--      Ej. real: ingreso 3.5M, ADUS topeado en 150M (USD 99.338), 20 años, UVI 2%.
--        vieja (income×rci):        $1.050.000/mes
--        real (amortización 150M):    $758.827/mes   (~38% menos)
--    Afecta leads CAP-limitados (ingreso alto). Los afford-limitados ya coincidían.
--    Mismo motor que usa el agente Ximia en vivo → también decía cuota inflada.
--    FIX: calcular la cuota a partir del loan FINAL (post-LEAST), invirtiendo la
--    anualidad. Afford-limitado → sigue dando income×rci (sin cambio). Cap-limitado →
--    baja al valor correcto.
--
-- Consumidores tras esto: TODOS caen en la de 10 args (qualify_leads: 10 args;
-- reconcile/mail vía PostgREST: 9 params → income_currency default; n8n: idem). Nada
-- pierde funcionalidad (income_currency default 'ARS', has_lot default null).
-- =============================================================================
begin;

-- 1) Limpiar overloads viejos (drop if exists = no-op si no están). Deja SOLO la de 10.
drop function if exists public.evaluate_property_options(numeric, numeric, integer, text, text, integer, text);                    -- 7 args (0058)
drop function if exists public.evaluate_property_options(numeric, numeric, integer, text, text, integer, text, text);              -- 8 args (0059)
drop function if exists public.evaluate_property_options(numeric, numeric, integer, text, text, integer, text, text, boolean);    -- 9 args (0085)

-- 2) Canónica (10 args) = cuerpo de 0077 + fix de cuota. Único cambio de lógica:
--    monthly_payment_ars se re-deriva del loan final en vez de quedar en income×rci.
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
stable
as $$
declare
    exchange_rate numeric; v_province_id uuid; v_savings_usd numeric; v_income_ars numeric;
    v_uva numeric; v_uvi numeric;
begin
    select value::numeric into exchange_rate from system_config where key='usd_exchange_rate' limit 1;
    if exchange_rate is null then raise exception 'Missing usd_exchange_rate in system_config'; end if;
    select value::numeric into v_uva from system_config where key='uva_value' limit 1;
    select value::numeric into v_uvi from system_config where key='uvi_value' limit 1;

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
               bf.max_loan_uvas, bf.interest_adjustment,
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
               e.requirements_text, e.max_area_m2, e.eff_rate,
               LEAST(
                 ( (v_income_ars * e.eff_rci) * (1 - power(1 + ((e.eff_rate/100.0)/12.0), -e.max_term_months))
                   / ((e.eff_rate/100.0)/12.0) ) / exchange_rate,
                 COALESCE(e.max_loan_amount_ars, 999999999999) / exchange_rate,
                 -- tope en UVAs → pesos (según el índice de la línea) → USD
                 COALESCE(e.max_loan_uvas * (case when upper(coalesce(e.interest_adjustment,'UVA'))='UVI'
                                                  then v_uvi else v_uva end), 999999999999) / exchange_rate
               ) as loan_possible_usd
        from elig e
    )
    select bs.bank_name, bs.product_name, bs.max_financing_pct, ROUND(bs.loan_possible_usd),
           floor(bs.max_term_months/12.0)::integer,
           -- FIX: cuota = amortización del loan REAL (post-tope), no el techo income×rci.
           -- (rate 0 → cuota lineal loan/n, para evitar división por cero.)
           ROUND(
             case when coalesce(bs.eff_rate,0) = 0
                  then (bs.loan_possible_usd * exchange_rate) / nullif(bs.max_term_months, 0)
                  else (bs.loan_possible_usd * exchange_rate) * ((bs.eff_rate/100.0)/12.0)
                       / (1 - power(1 + ((bs.eff_rate/100.0)/12.0), -bs.max_term_months))
             end
           ),
           ROUND(bs.loan_possible_usd + v_savings_usd), bs.requirements_text, bs.max_area_m2
    from bank_scenarios bs
    order by bs.max_financing_pct desc, bs.loan_possible_usd desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (revisar antes de COMMIT). Post-drop solo queda la de 10 → sin ambigüedad.
-- -----------------------------------------------------------------------------
-- (a) CAP-limitado (el que estaba roto): ingreso alto, Neuquén, con lote → ADUS topea en 150M.
--     La cuota ADUS ahora debe dar ~759k (no 1.05M).
select 'a) ADUS cap-limitado → cuota real ~759k' as check, bank_name, loan_possible_usd, loan_term_years, monthly_payment_ars
  from public.evaluate_property_options(0, 3500000, 2, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'ARS', true)
 where bank_name ilike '%habita%';

-- (b) AFFORD-limitado (no debe cambiar): ingreso bajo → cuota ≈ income×rci como antes.
select 'b) afford-limitado → cuota sin cambio' as check, bank_name, loan_possible_usd, monthly_payment_ars
  from public.evaluate_property_options(0, 900000, 2, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'ARS', true)
 where bank_name ilike '%habita%';

-- (c) Consolidación: solo debe quedar UN overload (el de 10 args).
select 'c) overloads vivos (debe ser 1)' as check, count(*) as n
  from pg_proc where proname = 'evaluate_property_options';

commit;
-- rollback;  -- usar en lugar de commit si algo no cuadra

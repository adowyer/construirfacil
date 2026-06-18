-- =============================================================================
-- 0072 — evaluate_property_options: simetría de moneda del INGRESO.
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit, mirar VERIFICACIÓN.
--
-- Bug (audit CRÍTICO C1, confirmado en Extractor.js "income SIEMPRE ARS"):
--   savings tiene p_savings_currency, pero el INGRESO se asume ARS sin parámetro.
--   Un ingreso dicho en USD ("gano 3.000 dólares") entra como 3000 ARS → subestimado
--   ~1000x → loan colapsa a ~0 Y el filtro max_household_income_ars pasa de largo
--   (un ingreso real ALTO se lee como bajísimo) → "no califica" falso y silencioso.
--
-- Fix: +param p_income_currency (10º, default 'ARS' → backward-compatible: las
--   llamadas viejas de 9 args siguen tratando el ingreso como ARS, sin cambio).
--   Internamente v_income_ars convierte USD→ARS y se usa en TODOS lados.
--
-- (El lado Ximia lo completa: Extractor.js debe etiquetar income_currency como ya
--  hace con savings_currency, y los tools pasar el 10º arg — ver migración hermana n8n.)
-- =============================================================================
begin;

-- Quitar la firma de 9 args (si no, la nueva de 10 con default matchea 9 → ambiguo).
drop function if exists public.evaluate_property_options(
    numeric, numeric, integer, text, text, integer, text, text, boolean);

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
    p_income_currency  text    default 'ARS'      -- NEW: 'ARS'|'USD' (simétrico con savings)
)
returns table (
    bank_name           text,
    product_name        text,
    max_financing_pct   numeric,
    loan_possible_usd   numeric,
    loan_term_years     integer,
    monthly_payment_ars numeric,
    total_budget_usd    numeric,
    requirements_text   text,
    max_area_m2         numeric
)
language plpgsql
as $$
declare
    exchange_rate numeric;
    v_province_id uuid;
    v_savings_usd numeric;
    v_income_ars  numeric;     -- NEW: ingreso normalizado a ARS
begin
    select value::numeric into exchange_rate
    from system_config where key = 'usd_exchange_rate' limit 1;

    if exchange_rate is null then
        raise exception 'Missing usd_exchange_rate in system_config';
    end if;

    v_savings_usd := coalesce(savings_usd, 0);
    if upper(coalesce(p_savings_currency, 'USD')) = 'ARS' then
        v_savings_usd := v_savings_usd / exchange_rate;
    end if;

    -- NEW: si el ingreso viene en USD, pasarlo a ARS (simétrico con savings).
    v_income_ars := coalesce(monthly_income_ars, 0);
    if upper(coalesce(p_income_currency, 'ARS')) = 'USD' then
        v_income_ars := v_income_ars * exchange_rate;
    end if;

    if p_province is not null then
        v_province_id := (
            select id from public.provincias
            where slug = translate(lower(p_province), 'áéíóúñ', 'aeioun')
               or name ilike p_province
            limit 1
        );
    end if;

    return query
    with elig as (
        select
            bf.bank_name,
            bf.product_name,
            bf.max_financing_pct,
            bf.max_term_months,
            bf.max_loan_amount_ars,
            bf.requirements_text,
            bf.max_area_m2,
            case when p_employment_type = 'employed'
                 then bf.interest_rate
                 else coalesce(bf.interest_rate_self_employed, bf.interest_rate) end as eff_rate,
            case when p_employment_type = 'employed'
                 then coalesce(bf.rci, 0.30)
                 else coalesce(bf.rci_self_employed, bf.rci, 0.30) end             as eff_rci
        from public.banks_financing bf
        where
            bf.is_active = true
            and (
                p_destination is null
                or bf.destination is null
                or bf.destination = p_destination
                or (p_destination = 'primera_vivienda' and bf.destination in ('primera_segunda', 'vivienda_unica'))
                or (p_destination = 'segunda_vivienda'  and bf.destination in ('primera_segunda'))
            )
            and (bf.provincia_id is null or bf.provincia_id = v_province_id)
            and (bf.min_residency_years is null or coalesce(p_residency_years, 0) >= bf.min_residency_years)
            and (bf.max_household_income_ars is null or v_income_ars <= bf.max_household_income_ars)  -- CHANGE: v_income_ars
            and (coalesce(bf.requires_own_lot, false) = false or coalesce(p_has_lot, true) = true)
    ),
    bank_scenarios as (
        select
            e.bank_name,
            e.product_name,
            e.max_financing_pct,
            e.max_term_months,
            e.requirements_text,
            e.max_area_m2,
            (v_income_ars * e.eff_rci) as monthly_payment_ars,                       -- CHANGE: v_income_ars
            LEAST(
                ( (v_income_ars * e.eff_rci) *                                        -- CHANGE: v_income_ars
                  (1 - power(1 + ((e.eff_rate / 100.0) / 12.0), -e.max_term_months))
                  / ((e.eff_rate / 100.0) / 12.0)
                ) / exchange_rate,
                COALESCE(e.max_loan_amount_ars, 999999999999) / exchange_rate
            ) as loan_possible_usd
        from elig e
    )
    select
        bs.bank_name,
        bs.product_name,
        bs.max_financing_pct,
        ROUND(bs.loan_possible_usd)                  as loan_possible_usd,
        floor(bs.max_term_months / 12.0)::integer    as loan_term_years,
        ROUND(bs.monthly_payment_ars)                as monthly_payment_ars,
        ROUND(bs.loan_possible_usd + v_savings_usd)  as total_budget_usd,
        bs.requirements_text,
        bs.max_area_m2
    from bank_scenarios bs
    order by bs.max_financing_pct desc, bs.loan_possible_usd desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT).
-- -----------------------------------------------------------------------------
-- A) Ingreso 5.000.000 ARS (default) → debe dar el loan de siempre (sin cambio).
select 'A ingreso ARS' chk, bank_name, loan_possible_usd
  from public.evaluate_property_options(20000, 5000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'USD', true)
 order by loan_possible_usd desc limit 3;

-- B) Mismo cliente pero ingreso dicho en USD: 5000 USD ≈ 5.000.000 ARS al cambio.
--    Antes daba loan ~0 (5000 leído como pesos). Ahora debe dar SIMILAR a (A).
select 'B ingreso USD' chk, bank_name, loan_possible_usd
  from public.evaluate_property_options(20000, 5000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'USD', true, 'USD')
 order by loan_possible_usd desc limit 3;

-- C) Backward-compat: llamada vieja de 9 args (sin income_currency) sigue = ARS.
select 'C 9-args compat' chk, count(*)
  from public.evaluate_property_options(20000, 5000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'USD', true);

commit;
-- rollback;

-- =============================================================================
-- DOWN (manual): recrear la firma de 9 args desde 0060.
-- =============================================================================

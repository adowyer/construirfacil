-- =============================================================================
-- ConstruirFácil — Motor financiero multi-línea + moneda de ahorros
-- Migration: 0059_multiline_credit_and_savings_currency.sql
-- =============================================================================
-- Prerequisito: 0058 (evaluate_property_options geo + empleo aware, 7 args).
--
-- Por qué:
--   El vendedor NO debería elegir UNA línea. Para un mismo prospecto conviven dos
--   historias y hay que poner LAS DOS sobre la mesa:
--     • la línea 100% (ej. ADUS Neuquén) → entra YA, sin anticipo, aunque tope 90 m²;
--     • la línea de mayor monto (ej. Nación) → casa más cara/grande SI consigue el
--       anticipo (25%) — juntando dólares o sumando un codeudor.
--   La 0058 hacía `order by loan_possible_usd desc LIMIT 1`, así que la línea de más
--   monto SIEMPRE tapaba a la 100%, y ADUS nunca salía aunque el prospecto calificara.
--
-- Qué hace:
--   1. REEMPLAZA evaluate_property_options() por una versión que:
--        - DEVUELVE TODAS las líneas elegibles (saca el LIMIT 1 interno). La selección
--          de "primaria vs aspiracional" la hace el Set Financial Result (n8n).
--        - ORDENA 100% primero (max_financing_pct desc), luego por monto.
--        - acepta p_savings_currency ('ARS'|'USD'): si 'ARS', convierte los ahorros a
--          USD con usd_exchange_rate (arregla el bug "30 millones de pesos" → 30M USD).
--   2. Firma nueva (+ p_savings_currency con DEFAULT 'USD') → DROP de la de 7 args primero.
--
-- NO toca banks_financing ni datos. Solo la función. Idempotente + transaccional.
-- La corre el founder. Revisar las queries de verificación antes de COMMIT.
-- =============================================================================

begin;

-- Firma 0058 (7 args) → la reemplazamos por la de 8 (agrega p_savings_currency).
drop function if exists public.evaluate_property_options(
  numeric, numeric, integer, text, text, integer, text
);

create or replace function public.evaluate_property_options(
    savings_usd        numeric,
    monthly_income_ars numeric,
    p_bedrooms         integer,                 -- compat; el filtro de dormitorios vive en el Recommendation Engine
    p_destination      text,
    p_province         text    default null,    -- provincia del prospecto ('Neuquén' / 'neuquen')
    p_residency_years  integer default null,    -- años de residencia en la provincia (ADUS ≥ 5)
    p_employment_type  text    default null,    -- 'employed' = dependencia; resto / NULL = autónomo (conservador)
    p_savings_currency text    default 'USD'    -- moneda de savings_usd: 'ARS' → se convierte con la cotización
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
begin
    select value::numeric into exchange_rate
    from system_config where key = 'usd_exchange_rate' limit 1;

    if exchange_rate is null then
        raise exception 'Missing usd_exchange_rate in system_config';
    end if;

    -- Moneda de los ahorros. Income SIEMPRE es ARS; savings puede venir en pesos
    -- (el usuario dice "30 millones") o en dólares ("20 mil dólares"). El Extractor
    -- etiqueta la moneda; acá la normalizamos a USD.
    v_savings_usd := coalesce(savings_usd, 0);
    if upper(coalesce(p_savings_currency, 'USD')) = 'ARS' then
        v_savings_usd := v_savings_usd / exchange_rate;
    end if;

    -- Resolver provincia → id sin depender de unaccent (translate quita acentos).
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
            and (bf.max_household_income_ars is null or monthly_income_ars <= bf.max_household_income_ars)
    ),
    bank_scenarios as (
        select
            e.bank_name,
            e.product_name,
            e.max_financing_pct,
            e.max_term_months,
            e.requirements_text,
            e.max_area_m2,
            (monthly_income_ars * e.eff_rci) as monthly_payment_ars,
            LEAST(
                ( (monthly_income_ars * e.eff_rci) *
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
    -- 100% primero (entra sin anticipo), luego por monto. SIN limit: devolvemos
    -- TODAS las líneas elegibles; n8n elige primaria + aspiracional.
    order by bs.max_financing_pct desc, bs.loan_possible_usd desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (revisar antes de COMMIT)
-- -----------------------------------------------------------------------------
-- Monotributista Neuquén que califica (residente 8 años, ingreso 5MM, primera vivienda):
-- AHORA debe devolver VARIAS filas, con ADUS (100%) PRIMERO y Nación/otras debajo.
select 'multi Neuquén' as check, *
  from public.evaluate_property_options(20000, 5000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'USD');

-- Mismo prospecto pero ahorros en PESOS ("30 millones de pesos"): savings se convierte
-- a USD con la cotización (no debe verse un budget de 30 millones de dólares).
select 'savings ARS' as check, total_budget_usd
  from public.evaluate_property_options(30000000, 5000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'ARS')
 order by max_financing_pct desc, loan_possible_usd desc
 limit 1;

-- Sin residencia suficiente (2 años) → ADUS NO aparece; quedan las demás.
select 'sin residencia' as check, bank_name, max_financing_pct
  from public.evaluate_property_options(20000, 5000000, 3, 'primera_vivienda', 'Neuquén', 2, 'self_employed_simplified', 'USD');

commit;
-- rollback;  -- usar en lugar de commit si algo no cuadra

-- =============================================================================
-- DOWN (revertir manualmente — NO se ejecuta por defecto)
-- =============================================================================
-- begin;
--   drop function if exists public.evaluate_property_options(
--     numeric, numeric, integer, text, text, integer, text, text);
--   -- recrear la versión de 7 args desde 0058 si hace falta.
-- commit;

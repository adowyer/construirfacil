-- =============================================================================
-- 0085 — has_lot gating: las líneas que exigen TERRENO PROPIO (ADUS / Neuquén Habita)
--        NO se ofrecen a quien no tiene lote.
--        (Renumerada desde 0060 — colisión con 0060_fix_terra_tipologia_split.sql.)
--
-- ⚠️ DRAFT para revisar por Andrea antes de correr. Dos cosas a confirmar:
--   (A) ¿QUÉ líneas exigen lote propio? Acá marco solo ADUS/Neuquén Habita por su
--       requisito de "escritura del inmueble a nombre del solicitante". Si Banco Neuquén
--       Vivienda Única u otras también lo exigen, agregalas en el UPDATE marcado.
--   (B) Corré dentro del begin/commit y mirá la VERIFICACIÓN antes de COMMIT.
--
-- Contexto: el SQL hoy devuelve ADUS sin chequear lote → le ofrecería ADUS a alguien
-- sin terreno (incorrecto). Esto agrega el flag `requires_own_lot` + un parámetro
-- `p_has_lot` a evaluate_property_options que excluye esas líneas cuando has_lot = false.
-- (El lado Ximia: el agente ya recolecta has_lot y lo pasará como 9º arg — ver XIMIA.)
-- =============================================================================
begin;

-- (1) Flag en las líneas
alter table public.banks_financing
  add column if not exists requires_own_lot boolean not null default false;

-- (2) Marcar las que exigen lote propio.
--     ADUS / Neuquén Habita: requisito explícito de terreno escriturado a nombre del solicitante.
update public.banks_financing
   set requires_own_lot = true
 where bank_name ilike '%neuquén habita%'
    or bank_name ilike '%neuquen habita%'
    or product_name ilike '%adus%';
-- ⬇️ AGREGAR ACÁ otras líneas que exijan lote propio, si las hay (Andrea):
-- update public.banks_financing set requires_own_lot = true where product_name ilike '%...%';

-- (3) Función: +param p_has_lot (9º) y +filtro en el CTE elig.
--     PRIMERO quitamos la versión de 8 args de 0059: si no, queda un overload ambiguo
--     (la nueva de 9 args con p_has_lot default null también matchea llamadas de 8 args →
--     "function is not unique"). La de 9 args cubre las llamadas de 8 (p_has_lot toma null).
drop function if exists public.evaluate_property_options(
    numeric, numeric, integer, text, text, integer, text, text);

--     La nueva es idéntica a 0059 salvo el nuevo parámetro y UNA línea de WHERE (marcadas con NEW).
create or replace function public.evaluate_property_options(
    savings_usd        numeric,
    monthly_income_ars numeric,
    p_bedrooms         integer,
    p_destination      text,
    p_province         text    default null,
    p_residency_years  integer default null,
    p_employment_type  text    default null,
    p_savings_currency text    default 'USD',
    p_has_lot          boolean default null      -- NEW: ¿tiene lote? false → excluye líneas requires_own_lot
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

    v_savings_usd := coalesce(savings_usd, 0);
    if upper(coalesce(p_savings_currency, 'USD')) = 'ARS' then
        v_savings_usd := v_savings_usd / exchange_rate;
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
            and (bf.max_household_income_ars is null or monthly_income_ars <= bf.max_household_income_ars)
            and (coalesce(bf.requires_own_lot, false) = false or coalesce(p_has_lot, true) = true)  -- NEW: sin lote → fuera las que exigen lote
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
    order by bs.max_financing_pct desc, bs.loan_possible_usd desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (revisar antes de COMMIT)
-- -----------------------------------------------------------------------------
-- Neuquén que califica, CON lote (p_has_lot=true): ADUS DEBE aparecer.
select 'con lote → ADUS aparece' as check, bank_name, max_financing_pct
  from public.evaluate_property_options(20000, 5000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'USD', true)
 where bank_name ilike '%habita%' or product_name ilike '%adus%';

-- Mismo prospecto SIN lote (p_has_lot=false): ADUS NO debe aparecer; quedan las demás.
select 'sin lote → ADUS fuera' as check, bank_name, max_financing_pct
  from public.evaluate_property_options(20000, 5000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'USD', false);

-- Backward-compat: llamada vieja de 8 args (p_has_lot toma default null = incluir todo) sigue andando.
select '8-args compat' as check, count(*)
  from public.evaluate_property_options(20000, 5000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified', 'USD');

commit;
-- rollback;  -- usar en lugar de commit si algo no cuadra

-- =============================================================================
-- DOWN (revertir manualmente — NO se ejecuta por defecto)
-- =============================================================================
-- begin;
--   -- recrear la función de 8 args desde 0059
--   drop function if exists public.evaluate_property_options(
--     numeric, numeric, integer, text, text, integer, text, text, boolean);
--   alter table public.banks_financing drop column if exists requires_own_lot;
-- commit;

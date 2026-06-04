-- =============================================================================
-- ConstruirFácil — Neuquén Habita / ADUS + motor financiero consciente del empleo
-- Migration: 0058_neuquen_habita_adus_credit.sql
-- =============================================================================
-- Prerequisito: 0050 (baseline) + 0051 (geo layer: columnas geo en banks_financing
-- + línea ADUS/IPVU Neuquén).
--
-- Qué hace:
--   1. CORRIGE max_financing_pct de la línea ADUS: 1.0 → 100.
--      (Bug 0051: el resto de la tabla usa puntos porcentuales 75/80/100; 1.0 daba
--      ltv = 0.01 en Set_Financial_Result.js → presupuesto roto en la línea estrella.)
--   2. RENOMBRA IPVU → marca real: "Neuquén Habita" / "Crédito Hipotecario ADUS".
--   3. TASA ADUS conservadora: 2 → 6 (UVI+6% = NO acredita haberes en BPN, el peor caso;
--      si bancariza con el Banco Provincia baja a UVI+2% → mejor de lo prometido).
--   4. COLUMNAS nuevas en banks_financing:
--        - requirements_text          (condiciones públicas; el GQ Finance las comunica)
--        - max_area_m2                (tope de superficie financiable; ADUS = 90 m²)
--        - interest_rate_self_employed (TNA para autónomo/monotributista; NULL = igual que interest_rate)
--        - rci_self_employed          (RCI para autónomo/monotributista; NULL = igual que rci)
--      Convención: interest_rate / rci = valores de RELACIÓN DE DEPENDENCIA (default);
--      las columnas *_self_employed = variante autónomo/monotributista.
--   5. POBLA Neuquén (ADUS + las 2 líneas Banco Neuquén) con las variantes por empleo.
--   6. REEMPLAZA evaluate_property_options() por una versión geo + destino + empleo aware:
--        - filtra por provincia / residencia / ingreso
--        - corrige el matching de destino (vocabulario mixto)
--        - elige TASA y RCI según el tipo de empleo del prospecto
--        - devuelve requirements_text + max_area_m2
--
-- Las líneas NACIONALES quedan con *_self_employed en NULL (→ caen a su valor actual)
-- hasta confirmar los datos nacionales (en revisión). Se completan en la misma columna.
--
-- Idempotente + transaccional. La corre el founder. Revisar antes de COMMIT.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1 + 3. Fix de la línea ADUS: financiación 1.0 → 100, tasa conservadora 2 → 6.
-- -----------------------------------------------------------------------------
update public.banks_financing
   set max_financing_pct = 100,
       interest_rate     = 6           -- UVI + 6% por default (no acredita haberes en BPN)
 where bank_name = 'IPVU Neuquén';

-- -----------------------------------------------------------------------------
-- 4. Columnas nuevas.
-- -----------------------------------------------------------------------------
alter table public.banks_financing
  add column if not exists requirements_text           text,
  add column if not exists max_area_m2                 numeric,
  add column if not exists interest_rate_self_employed numeric,
  add column if not exists rci_self_employed           numeric;

comment on column public.banks_financing.requirements_text is
  'Condiciones/requisitos públicos de la línea, en prosa. El GQ Finance los comunica al pre-calificar: el usuario debe cumplir TODAS para acceder realmente al crédito.';
comment on column public.banks_financing.max_area_m2 is
  'Superficie máxima financiable de la vivienda (ej. Neuquén Habita = 90 m²). NULL = sin tope. La usa el Recommendation Engine para no recomendar casas por encima del tope.';
comment on column public.banks_financing.interest_rate_self_employed is
  'TNA para clientes autónomos/monotributistas. NULL = misma que interest_rate (que es la de relación de dependencia).';
comment on column public.banks_financing.rci_self_employed is
  'Relación cuota/ingreso para autónomos/monotributistas. NULL = misma que rci (que es la de relación de dependencia).';

-- -----------------------------------------------------------------------------
-- 2 + 5a. Renombrar ADUS y poblar condiciones + tope de superficie.
--         (ADUS: tasa y RCI iguales para ambos buckets → *_self_employed quedan NULL.)
-- -----------------------------------------------------------------------------
update public.banks_financing
   set bank_name    = 'Neuquén Habita',
       product_name = 'Crédito Hipotecario ADUS',
       max_area_m2  = 90,
       requirements_text =
'Programa Neuquén Habita — Créditos Hipotecarios ADUS. Requisitos clave (deben cumplirse TODOS para acceder):
- Tener entre 18 y 65 años.
- Destino: construcción, refacción o ampliación de vivienda única y de ocupación permanente.
- La construcción no puede superar los 90 m².
- Escritura del inmueble a nombre del solicitante.
- Inscripción actualizada en el RUPROVI 2.0.
- Residencia inmediata mínima de 5 años en la Provincia del Neuquén (Ley 2639, Art. 6, Inc. b.2).
- Relación cuota/ingreso no mayor al 30% de los ingresos netos del grupo familiar.
- Ingreso neto máximo del grupo familiar: $6.500.000 (o 18 salarios mínimos vitales y móviles vigentes al momento de la solicitud).
- Garantía hipotecaria en primer grado y seguros de vida e incendio.
- No estar inscripto en el Registro de Deudores Alimentarios Morosos.
- No estar inscripto en el Registro Provincial de Violencia Familiar y de Género.
- No tener crédito y/o adjudicación vigente con ADUS / IPVU.
- Tasa: UVI + 2% TNA si acredita haberes en el Banco Provincia del Neuquén; UVI + 6% TNA en caso contrario (tomamos 6% por defecto).'
 where bank_name = 'IPVU Neuquén';

-- -----------------------------------------------------------------------------
-- 5b. Variantes por empleo de las 2 líneas Banco Neuquén (Construcción, Vivienda Única).
--     interest_rate / rci YA tienen el valor de dependencia (3,5 / 8,5 y 0,30).
--     Fuente: página oficial Banco Neuquén + planilla del estudio.
-- -----------------------------------------------------------------------------
-- Construcción hasta 75M: dep 3,5% / autónomo 4,5% ; RCI dep 30% / autónomo 25%
update public.banks_financing
   set interest_rate_self_employed = 4.5,
       rci_self_employed           = 0.25
 where bank_name = 'Banco Neuquén' and product_name = 'Hipotecario Vivienda Única 1';

-- Construcción hasta 150M: dep 8,5% / autónomo 9,5% ; RCI dep 30% / autónomo 25%
update public.banks_financing
   set interest_rate_self_employed = 9.5,
       rci_self_employed           = 0.25
 where bank_name = 'Banco Neuquén' and product_name = 'Hipotecario Vivienda Única 2';

-- -----------------------------------------------------------------------------
-- 6. evaluate_property_options — geo + destino + empleo aware.
--    Firma nueva (+ p_province, p_residency_years, p_employment_type, todos con
--    DEFAULT null) → DROP de la vieja primero. Una llamada de 4 args sigue andando
--    (se comporta como antes: sin geo-gating; empleo desconocido = bucket autónomo).
-- -----------------------------------------------------------------------------
drop function if exists public.evaluate_property_options(numeric, numeric, integer, text);

create or replace function public.evaluate_property_options(
    savings_usd        numeric,
    monthly_income_ars numeric,
    p_bedrooms         integer,                 -- compatibilidad; el filtro de dormitorios vive en el Recommendation Engine
    p_destination      text,
    p_province         text    default null,    -- provincia del prospecto ('Neuquén' / 'neuquen')
    p_residency_years  integer default null,    -- años de residencia en la provincia (líneas tipo ADUS ≥ 5)
    p_employment_type  text    default null     -- 'employed' = dependencia; cualquier otro / NULL = autónomo (conservador)
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
begin
    select value::numeric into exchange_rate
    from system_config where key = 'usd_exchange_rate' limit 1;

    if exchange_rate is null then
        raise exception 'Missing usd_exchange_rate in system_config';
    end if;

    -- Resolver provincia → id sin depender de la extensión unaccent (translate quita acentos).
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
        -- Líneas elegibles + tasa y RCI EFECTIVOS según el tipo de empleo.
        select
            bf.bank_name,
            bf.product_name,
            bf.max_financing_pct,
            bf.max_term_months,
            bf.max_loan_amount_ars,
            bf.requirements_text,
            bf.max_area_m2,
            -- 'employed' = relación de dependencia → tasa/RCI base.
            -- Autónomo/monotributista (o desconocido = conservador) → variante self_employed.
            case when p_employment_type = 'employed'
                 then bf.interest_rate
                 else coalesce(bf.interest_rate_self_employed, bf.interest_rate) end as eff_rate,
            case when p_employment_type = 'employed'
                 then coalesce(bf.rci, 0.30)
                 else coalesce(bf.rci_self_employed, bf.rci, 0.30) end             as eff_rci
        from public.banks_financing bf
        where
            bf.is_active = true
            -- Destino compatible. Vocabulario mixto: primera_segunda / primera_vivienda /
            -- segunda_vivienda / vivienda_unica. Una "primera vivienda" también califica
            -- para líneas 'primera_segunda' y 'vivienda_unica'.
            and (
                p_destination is null
                or bf.destination is null
                or bf.destination = p_destination
                or (p_destination = 'primera_vivienda' and bf.destination in ('primera_segunda', 'vivienda_unica'))
                or (p_destination = 'segunda_vivienda'  and bf.destination in ('primera_segunda'))
            )
            -- Geo-gating: nacional (provincia null) o de la provincia del prospecto.
            and (bf.provincia_id is null or bf.provincia_id = v_province_id)
            -- Residencia mínima (ADUS ≥ 5 años). Sin dato → no califica a líneas que la exigen.
            and (bf.min_residency_years is null or coalesce(p_residency_years, 0) >= bf.min_residency_years)
            -- Tope de ingreso familiar mensual (ADUS < 6,5MM ARS).
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
            (monthly_income_ars * e.eff_rci) as monthly_payment_ars,   -- capacidad de cuota (ARS), por empleo
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
        ROUND(bs.loan_possible_usd)               as loan_possible_usd,
        floor(bs.max_term_months / 12.0)::integer as loan_term_years,
        ROUND(bs.monthly_payment_ars)             as monthly_payment_ars,
        ROUND(bs.loan_possible_usd + savings_usd) as total_budget_usd,
        bs.requirements_text,
        bs.max_area_m2
    from bank_scenarios bs
    order by bs.loan_possible_usd desc, bs.max_financing_pct desc
    limit 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (revisar antes de COMMIT)
-- -----------------------------------------------------------------------------
select 'líneas Neuquén' as check, bank_name, product_name, max_financing_pct,
       interest_rate, interest_rate_self_employed, rci, rci_self_employed,
       max_area_m2, min_residency_years, max_household_income_ars
  from public.banks_financing
 where provincia_id = (select id from public.provincias where slug = 'neuquen')
 order by product_name;

-- Monotributista Neuquén que califica (residente 8 años, ingreso 4MM, primera vivienda)
-- → debería ganar ADUS (UVI+6% conservador, 100%, 240m):
select 'ADUS monotrib' as check, *
  from public.evaluate_property_options(0, 4000000, 3, 'primera_vivienda', 'Neuquén', 8, 'self_employed_simplified');

-- Mismo prospecto SIN residencia suficiente (2 años) → NO ADUS; cae a Banco Neuquén
-- (vivienda_unica), con tasa/RCI de autónomo (4,5% / 25%):
select 'sin residencia' as check, *
  from public.evaluate_property_options(0, 4000000, 3, 'primera_vivienda', 'Neuquén', 2, 'self_employed_simplified');

-- Empleado en relación de dependencia, nacional → líneas nacionales, RCI 30%:
select 'nacional dep' as check, *
  from public.evaluate_property_options(25000, 3000000, 3, 'primera_vivienda', null, null, 'employed');

commit;
-- rollback;  -- usar en lugar de commit si algo no cuadra

-- =============================================================================
-- DOWN (revertir manualmente — NO se ejecuta por defecto)
-- =============================================================================
-- begin;
--   update public.banks_financing
--      set bank_name = 'IPVU Neuquén', product_name = 'IPVU Vivienda Única',
--          max_financing_pct = 1.0, interest_rate = 2,
--          max_area_m2 = null, requirements_text = null
--    where bank_name = 'Neuquén Habita';
--   update public.banks_financing
--      set interest_rate_self_employed = null, rci_self_employed = null
--    where bank_name = 'Banco Neuquén';
--   alter table public.banks_financing
--     drop column if exists requirements_text,
--     drop column if exists max_area_m2,
--     drop column if exists interest_rate_self_employed,
--     drop column if exists rci_self_employed;
--   drop function if exists public.evaluate_property_options(numeric, numeric, integer, text, text, integer, text);
--   -- (recrear la versión vieja de 4 args desde el respaldo si hace falta)
-- commit;

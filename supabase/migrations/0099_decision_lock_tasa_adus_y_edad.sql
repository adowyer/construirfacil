-- =============================================================================
-- 0099 — Restaura la tasa ADUS al 6% (D-001) y modela la edad 18–65 (D-005).
--
-- ⚠️ DRAFT. NO correr sin el "dale" explícito de Andrea: mueve TODAS las
--    cotizaciones ADUS (~29% hacia abajo) de 40 personas ya contactadas por mail.
--
-- ⚠️ CORRER `scripts/test_conformidad.sql` DESPUÉS. Debe pasar entero.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ EXISTE ESTA MIGRACIÓN (leer antes de tocar `interest_rate`)
--
--   0058 (política): bajó la tasa ADUS de 2 → 6. Razón: el programa da UVI+2%
--         SOLO a quien acredita haberes en el Banco Provincia del Neuquén, y
--         UVI+6% al resto. No podemos verificarlo masivamente → peor caso.
--         Lo dejó anotado en un COMENTARIO.
--
--   0076 (error):   la devolvió 6 → 2 leyendo ese 6 como "override stale",
--         citando una planilla que muestra el 2% — que es el 2% CONDICIONADO.
--         Se rotuló "único cambio confirmado" bajo un encabezado donde lo que
--         Andrea había confirmado era la tabla del BPN, otra línea distinta.
--         Nadie confirmó este cambio.
--
--   Consecuencia: 40 créditos del sindicato cotizados ~29% de más y comunicados
--   por mail. El comentario de advertencia de 0058 existía y no frenó nada.
--
--   Por eso a partir de acá la decisión vive en `docs/DECISIONES.md` (D-001) y
--   el candado en `scripts/test_conformidad.sql`, que FALLA si alguien la mueve.
--   Un comentario en prosa no es una garantía. (GOLDEN RULE.)
--
--   Para volver al 2% hace falta el dato "¿dónde cobra?" por persona. Se está
--   preguntando una por una en las llamadas. Cuando exista, la tasa pasa a
--   depender del lead y se reemplaza D-001 — no se edita en silencio.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. D-001 · Tasa ADUS → 6 (UVI + 6% TNA por defecto).
-- -----------------------------------------------------------------------------
update public.banks_financing
   set interest_rate       = 6,
       interest_adjustment = coalesce(interest_adjustment, 'UVI')
 where bank_name = 'Neuquén Habita'
   and product_name = 'Crédito Hipotecario ADUS';

-- -----------------------------------------------------------------------------
-- 2. D-005 · Edad: columnas nuevas + valores ADUS.
--    Hoy no excluye a nadie por edad real (todos en actividad), pero la
--    condición es del programa y tiene que estar modelada.
-- -----------------------------------------------------------------------------
alter table public.banks_financing
  add column if not exists min_age integer,
  add column if not exists max_age integer;

comment on column public.banks_financing.min_age is
  'Edad mínima del solicitante. NULL = sin mínimo. El motor NO excluye si la edad del prospecto es desconocida (ver D-007: hay fechas de nacimiento corruptas por OCR; rechazar por un error nuestro es peor que dejar pasar).';
comment on column public.banks_financing.max_age is
  'Edad máxima del solicitante. NULL = sin máximo. Misma regla de desconocido-no-excluye que min_age.';

update public.banks_financing
   set min_age = 18, max_age = 65
 where bank_name = 'Neuquén Habita'
   and product_name = 'Crédito Hipotecario ADUS';

-- -----------------------------------------------------------------------------
-- 3. Motor: agrega `p_age` (11º parámetro, default null).
--    Hay que DROPEAR la de 10 args: agregar un parámetro crea otra función y
--    dejaría dos firmas ambiguas. Los callers que pasan 10 args siguen andando
--    contra la nueva (p_age cae al default null → no filtra por edad).
--
--    NO se agrega `p_has_deed`: la escritura es requisito BLANDO (D-004), avisa
--    pero no excluye. Si alguien la agrega acá, está endureciéndola sin preguntar.
-- -----------------------------------------------------------------------------
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
    p_income_currency  text    default 'ARS',
    p_age              integer default null
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
          -- D-005 · edad. `p_age is null` NO excluye: edad desconocida se resuelve
          -- en la llamada, no rechazando (D-007 — fechas de nacimiento corruptas).
          and (bf.min_age is null or p_age is null or p_age >= bf.min_age)
          and (bf.max_age is null or p_age is null or p_age <= bf.max_age)
    ),
    bank_scenarios as (
        select e.bank_name, e.product_name, e.max_financing_pct, e.max_term_months,
               e.requirements_text, e.max_area_m2, e.eff_rate,
               LEAST(
                 ( (v_income_ars * e.eff_rci) * (1 - power(1 + ((e.eff_rate/100.0)/12.0), -e.max_term_months))
                   / ((e.eff_rate/100.0)/12.0) ) / exchange_rate,
                 COALESCE(e.max_loan_amount_ars, 999999999999) / exchange_rate,
                 COALESCE(e.max_loan_uvas * (case when upper(coalesce(e.interest_adjustment,'UVA'))='UVI'
                                                  then v_uvi else v_uva end), 999999999999) / exchange_rate
               ) as loan_possible_usd
        from elig e
    )
    select bs.bank_name, bs.product_name, bs.max_financing_pct, ROUND(bs.loan_possible_usd),
           floor(bs.max_term_months/12.0)::integer,
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
-- VERIFICACIÓN — mirar ANTES de commitear.
-- -----------------------------------------------------------------------------
-- (a) La tasa quedó en 6 y la edad cargada.
select 'a) ADUS' as check, interest_rate tasa, interest_adjustment indice, min_age, max_age
  from public.banks_financing
 where bank_name='Neuquén Habita' and product_name='Crédito Hipotecario ADUS';

-- (b) Perfil tipo tanda (ingreso 2,0M, 45 años, con lote, Neuquén):
--     ADUS debe pasar de ~78.546 (tasa 2) a ~55.463 (tasa 6).
select 'b) ingreso 2,0M · 45 años' as check, bank_name, product_name, loan_possible_usd, monthly_payment_ars
  from public.evaluate_property_options(0, 2000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', 45)
 order by loan_possible_usd desc;

-- (c) 70 años → ADUS NO debe aparecer.
select 'c) 70 años → sin ADUS' as check, count(*) filter (where bank_name='Neuquén Habita') as adus_rows
  from public.evaluate_property_options(0, 2000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', 70);

-- (d) Edad desconocida → ADUS SÍ debe aparecer (D-007: no rechazar por falta de dato).
select 'd) edad null → con ADUS' as check, count(*) filter (where bank_name='Neuquén Habita') as adus_rows
  from public.evaluate_property_options(0, 2000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', null);

-- (e) Los callers de 10 args siguen resolviendo (p_age → default null).
select 'e) compat 10 args' as check, count(*) as filas
  from public.evaluate_property_options(0, 2000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS');

commit;
-- rollback;

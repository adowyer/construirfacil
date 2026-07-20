-- =============================================================================
-- test_conformidad.sql — EL CANDADO de las decisiones cerradas.
--
-- Afirma, contra la DB VIVA, los valores que figuran en `docs/DECISIONES.md`.
-- Si alguien mueve uno, esto explota con el número de decisión que violó.
--
-- ⚠️ CORRERLO ANTES Y DESPUÉS de cualquier migración que toque `banks_financing`
--    o `evaluate_property_options`. Es SOLO LECTURA: no escribe nada, no necesita
--    transacción, se puede correr cuantas veces se quiera.
--
-- Por qué existe: la 0058 decidió la tasa ADUS al 6% y lo dejó en un COMENTARIO.
-- La 0076 la pisó 18 migraciones después sin que nada se quejara → 40 créditos
-- cotizados 29% de más. Un comentario en prosa no es una garantía (GOLDEN RULE).
--
-- Al agregar una decisión a DECISIONES.md, agregá su assert acá. Un renglón en el
-- registro sin assert acá es una decisión sin candado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PARTE 1 — Valores de tabla (las decisiones, literales)
-- -----------------------------------------------------------------------------
do $$
declare a record; errs text[] := '{}';
begin
  select * into a from public.banks_financing
   where bank_name='Neuquén Habita' and product_name='Crédito Hipotecario ADUS';

  if a is null then
    raise exception 'CONFORMIDAD: no existe la línea ADUS (Neuquén Habita) en banks_financing';
  end if;

  -- D-001 · tasa 6% (UVI+6 por defecto; el 2% exige acreditar haberes en BPN)
  if a.interest_rate is distinct from 6 then
    errs := errs || format('D-001 tasa ADUS: esperado 6, encontrado %s', a.interest_rate);
  end if;
  if upper(coalesce(a.interest_adjustment,'')) is distinct from 'UVI' then
    errs := errs || format('D-001 índice ADUS: esperado UVI, encontrado %s', a.interest_adjustment);
  end if;

  -- D-002 · vivienda única
  if a.destination is distinct from 'vivienda_unica' then
    errs := errs || format('D-002 destino ADUS: esperado vivienda_unica, encontrado %s', a.destination);
  end if;

  -- D-003 · tope de ingreso FAMILIAR
  if a.max_household_income_ars is distinct from 6500000 then
    errs := errs || format('D-003 tope ingreso familiar: esperado 6500000, encontrado %s', a.max_household_income_ars);
  end if;

  -- D-004 · escritura es requisito BLANDO: NO debe existir como filtro del motor.
  --   Si alguien agrega una columna requires_deed y la prende, está excluyendo gente
  --   que las asesoras pueden ayudar a regularizar. Ver D-004.

  -- D-005 · edad 18-65
  if a.min_age is distinct from 18 or a.max_age is distinct from 65 then
    errs := errs || format('D-005 edad ADUS: esperado 18-65, encontrado %s-%s', a.min_age, a.max_age);
  end if;

  -- Condiciones de base que ya estaban bien (que nadie las pise tampoco)
  if a.rci is distinct from 0.30 then
    errs := errs || format('RCI ADUS: esperado 0.30, encontrado %s', a.rci);
  end if;
  if a.min_residency_years is distinct from 5 then
    errs := errs || format('Residencia ADUS: esperado 5, encontrado %s', a.min_residency_years);
  end if;
  if a.max_area_m2 is distinct from 90 then
    errs := errs || format('Superficie ADUS: esperado 90, encontrado %s', a.max_area_m2);
  end if;
  if a.max_term_months is distinct from 240 then
    errs := errs || format('Plazo ADUS: esperado 240, encontrado %s', a.max_term_months);
  end if;
  if coalesce(a.requires_own_lot,false) is distinct from true then
    errs := errs || format('requires_own_lot ADUS: esperado true, encontrado %s', a.requires_own_lot);
  end if;

  if array_length(errs,1) > 0 then
    raise exception E'❌ CONFORMIDAD ROTA — se violaron decisiones cerradas:\n  - %\n\nVer docs/DECISIONES.md. NO seguir sin preguntarle a Andrea.',
      array_to_string(errs, E'\n  - ');
  end if;
  raise notice '✅ PARTE 1 — valores de tabla ADUS conformes (D-001..D-005).';
end $$;

-- -----------------------------------------------------------------------------
-- PARTE 2 — Comportamiento del motor (casos con resultado escrito a mano)
--
-- Esto es lo que habría cazado el bug de `first_home`: no mira columnas, mira
-- qué DEVUELVE el motor ante un caso cuyo resultado correcto ya sabemos.
-- -----------------------------------------------------------------------------
do $$
declare
  n_adus int; v_loan numeric; errs text[] := '{}';
begin
  -- CASO A · perfil ADUS válido → DEBE aparecer.
  --   45 años, primera vivienda, Neuquén, 10 años residencia, lote escriturado,
  --   ingreso familiar 2,0M (bajo el tope de 6,5M).
  select count(*) into n_adus from public.evaluate_property_options(
    0, 2000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', 45)
   where bank_name='Neuquén Habita';
  if n_adus = 0 then
    errs := errs || 'CASO A: perfil ADUS válido NO recibió ADUS (falso negativo)';
  end if;

  -- CASO B · D-002 — ya tiene vivienda → NO debe recibir ADUS.
  select count(*) into n_adus from public.evaluate_property_options(
    0, 2000000, 2, 'segunda_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', 45)
   where bank_name='Neuquén Habita';
  if n_adus > 0 then
    errs := errs || 'CASO B: ADUS otorgado a segunda_vivienda (es el bug de first_home de 2026-07-18)';
  end if;

  -- CASO C · D-003 — ingreso FAMILIAR 7,0M (2,0M + cónyuge 5,0M) supera el tope → NO ADUS.
  --   Individual solo (2,0M) pasaría: por eso el caller DEBE sumar al cónyuge.
  select count(*) into n_adus from public.evaluate_property_options(
    0, 7000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', 45)
   where bank_name='Neuquén Habita';
  if n_adus > 0 then
    errs := errs || 'CASO C: ADUS otorgado con ingreso familiar 7,0M (tope 6,5M)';
  end if;

  -- CASO D · D-005 — 70 años → NO ADUS.
  select count(*) into n_adus from public.evaluate_property_options(
    0, 2000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', 70)
   where bank_name='Neuquén Habita';
  if n_adus > 0 then
    errs := errs || 'CASO D: ADUS otorgado a persona de 70 años (tope 65)';
  end if;

  -- CASO E · D-004 — sin test: la escritura NO es parámetro del motor, a propósito.
  --   Es requisito BLANDO (las asesoras ayudan a regularizarla), así que no filtra.
  --   Si algún día aparece un `p_has_deed` en esta firma, alguien convirtió un
  --   requisito blando en duro sin preguntar → volver a D-004 antes de aceptarlo.
  --   (El CASO A ya cubre que un perfil sin escritura recibe ADUS.)

  -- CASO F · residencia 2 años (< 5) → NO ADUS.
  select count(*) into n_adus from public.evaluate_property_options(
    0, 2000000, 2, 'primera_vivienda', 'Neuquén', 2, 'employed', 'ARS', true, 'ARS', 45)
   where bank_name='Neuquén Habita';
  if n_adus > 0 then
    errs := errs || 'CASO F: ADUS otorgado con 2 años de residencia (mínimo 5)';
  end if;

  -- CASO G · fuera de Neuquén → NO ADUS.
  select count(*) into n_adus from public.evaluate_property_options(
    0, 2000000, 2, 'primera_vivienda', 'Río Negro', 10, 'employed', 'ARS', true, 'ARS', 45)
   where bank_name='Neuquén Habita';
  if n_adus > 0 then
    errs := errs || 'CASO G: ADUS otorgado fuera de Neuquén';
  end if;

  -- CASO H · D-001 — la tasa efectiva. Con 6% y RCI 0,30 sobre 2,0M a 240 meses,
  --   el crédito ADUS debe rondar USD 55.463 (al 2% daba 78.546: la señal del bug).
  select loan_possible_usd into v_loan from public.evaluate_property_options(
    0, 2000000, 2, 'primera_vivienda', 'Neuquén', 10, 'employed', 'ARS', true, 'ARS', 45)
   where bank_name='Neuquén Habita' limit 1;
  if v_loan is not null and abs(v_loan - 55463) > 1500 then
    errs := errs || format('CASO H: crédito ADUS %s USD, esperado ~55.463 (±1500). Si da ~78.546, la tasa volvió al 2%% → D-001.', v_loan);
  end if;

  if array_length(errs,1) > 0 then
    raise exception E'❌ CONFORMIDAD ROTA — el motor no respeta las condiciones ADUS:\n  - %\n\nVer docs/DECISIONES.md.',
      array_to_string(errs, E'\n  - ');
  end if;
  raise notice '✅ PARTE 2 — comportamiento del motor conforme (casos A..H).';
end $$;

-- -----------------------------------------------------------------------------
-- Estado vivo, para mirar de reojo después de correr el test.
-- -----------------------------------------------------------------------------
select bank_name, product_name, destination,
       interest_rate tasa, interest_adjustment indice, rci,
       max_term_months plazo, max_household_income_ars ing_max,
       min_residency_years resid, max_area_m2 area, requires_own_lot lote,
       min_age, max_age, is_active
  from public.banks_financing
 order by provincia_id nulls first, bank_name, product_name;

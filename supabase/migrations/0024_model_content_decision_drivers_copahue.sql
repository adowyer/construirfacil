-- =============================================================================
-- ConstruirFácil — Molde definitivo: decision_drivers + CEDRO/COPAHUE
-- Migration: 0024_model_content_decision_drivers_copahue.sql
-- =============================================================================
-- Depende de 0022 (columnas vibe/perfect_for/not_for/emotional_anchors/
-- vs_alternatives) y 0021 (backfill CEDRO de esos 5 campos).
--
-- Qué hace:
--   1. Agrega la columna `decision_drivers text[]` (aditiva, idempotente).
--   2. CEDRO (BOSQUE): setea SOLO decision_drivers (los otros 5 ya validados
--      en 0021).
--   3. COPAHUE (TERRA): reescribe los 6 campos en registro CEDRO (descarta la
--      versión "accesible cálida"). Eje = primer hogar / permanencia, voz
--      confiada, sin mencionar precio.
--
-- A PRUEBA DE ORDEN respecto de 0023 (normalización de `linea`): el WHERE
--   matchea AMBAS formas de linea ('BOSQUE' y 'LÍNEA BOSQUE', etc.), así que
--   esta migración da el mismo resultado se aplique ANTES o DESPUÉS de 0023.
--   Si se aplica antes, 0023 luego renormaliza `linea` solo — el dato queda
--   correcto sin recargar. style_name CEDRO/COPAHUE no llevan tilde → no
--   requieren normalización en el WHERE.
--
-- Idempotente (UPDATE determinista; las filas ya existen). Transacción única.
-- =============================================================================

begin;

alter table public.model_content
  add column if not exists decision_drivers text[];

comment on column public.model_content.decision_drivers is
  'Detalles concretos y diferenciales que mueven la decision (DVH, terminaciones, pisos, techos), registro CEDRO. Cima curada de technical_notes/attributes; distinto de emotional_anchors.';

-- ---------------------------------------------------------------------------
-- CEDRO (BOSQUE) — solo decision_drivers; los otros 5 campos ya en 0021
-- ---------------------------------------------------------------------------
update public.model_content set
  decision_drivers = array[
    'Dos plantas con voladizos profundos: estructura y diseño en un mismo gesto',
    'Madera oscura como piel del frente — identidad, no un revestimiento aplicado',
    'Carpintería negra de piso a techo en los accesos: luz controlada, no improvisada'
  ]
where style_name = 'CEDRO'
  and upper(btrim(linea)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE');

-- ---------------------------------------------------------------------------
-- COPAHUE (TERRA) — reescrito en registro CEDRO (6 campos)
-- ---------------------------------------------------------------------------
update public.model_content set
  vibe = 'La casa sin fecha de vencimiento — sobria, sólida, pensada para durar toda una vida.',
  perfect_for = array[
    'Quien compra su primera casa y quiere que sea la definitiva, no un escalón',
    'Familia que arranca (2-4) y prioriza solidez y permanencia por sobre la moda',
    'Quien busca la serenidad del campo sin resignar confort ni eficiencia'
  ],
  not_for = array[
    'Si buscás un frente que haga una declaración arquitectónica fuerte (más expresivos: DOMUYO o TROMEN)',
    'Si querés gran escala o doble altura — su virtud es la eficiencia compacta'
  ],
  emotional_anchors = array[
    'el silencio de adentro cuando el clima se vuelve hostil',
    'la calidez táctil del beige texturado, no un color pintado encima',
    'la paleta terracota que hace que cada ambiente reciba'
  ],
  decision_drivers = array[
    'Aberturas de PVC tono madera con DVH: el confort no depende del clima de afuera',
    'Hormigón con aislación superior — silencio real y temperatura estable todo el año',
    'Cocina a medida y suelos en terracota: terminación para perdurar, no para renovar'
  ],
  vs_alternatives = jsonb_build_object(
    'DOMUYO', 'Si querés carácter arquitectónico fuerte (el gran arco de hormigón) en vez de la sobriedad atemporal.',
    'LANÍN',  'Si preferís la luminosidad del blanco mediterráneo a la calidez del beige campestre.',
    'TROMEN', 'Si buscás un frente que se note —color, ritmo— en lugar de la calma que no pasa de moda.'
  )
where style_name = 'COPAHUE'
  and upper(btrim(linea)) in ('TERRA','LINEA TERRA','LÍNEA TERRA');

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte)
-- =============================================================================
-- select style_name, linea,
--        vibe,
--        perfect_for, not_for, emotional_anchors, decision_drivers,
--        vs_alternatives
--   from public.model_content
--  where style_name in ('CEDRO','COPAHUE')
--  order by style_name;
--
-- Esperado: CEDRO con decision_drivers (3 ítems) + sus 5 campos de 0021;
--           COPAHUE con los 6 campos poblados en registro CEDRO.
-- =============================================================================

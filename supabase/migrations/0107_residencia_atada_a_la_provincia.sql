-- 0107_residencia_atada_a_la_provincia.sql
--
-- X-02a (auditoría 2026-08-01) — LA RESIDENCIA ES UNA VERDAD *DE UNA PROVINCIA*, NO UNA CONSTANTE
--
-- DE DÓNDE VIENE
-- --------------
-- La `0106` agregó `leads.meets_residency` para que el agente dejara de inventar un número de años
-- ("30" sobre un *"vivimos en Neuquén de toda la vida"*). El booleano significaba, implícitamente,
-- "cumple 5 años" — porque hoy la única línea que pide residencia es Neuquén Habita (ADUS), 5 años.
--
-- Andrea marcó las dos fallas de ese implícito (2026-08-02):
--
--   1. **"Residencia sólo importa cuando en la provincia del cliente hay una línea que la pide;
--      si no, es un dato completamente irrelevante."** El guard preguntaba la residencia a un
--      comprador de Misiones, donde NINGUNA línea la exige. Una pregunta de más en 6 de cada 7 casos.
--
--   2. **"Es una verdad sólo para la provincia para la que se respondió."** Si alguien carga mañana
--      una línea de Chaco que pida 10 años, el `true` guardado —que contestó "¿5 años?"— se leería
--      como "cumple 10". El booleano no sabe a qué pregunta contestó. Eso es exactamente la falla
--      que originó `docs/DECISIONES.md`: una regla cierta hoy, convertida en supuesto invisible.
--
-- QUÉ CAMBIA
-- ----------
-- El umbral deja de ser una constante del código y pasa a derivarse de `banks_financing` para la
-- provincia del lead. Y la respuesta guarda **contra qué umbral se respondió**, así un cambio de
-- requisito se DETECTA (la respuesta queda vencida y Ximia vuelve a preguntar) en vez de leerse mal
-- en silencio.
--
--   meets_residency = true  + residency_years_required = 5   -> "sí, vivimos hace 5+ años"
--   meets_residency = null                                    -> nadie lo dijo (≠ "no cumple")
--   residency_years_required <> el umbral vivo de su provincia -> respuesta VENCIDA, se re-pregunta
--
-- Como el umbral vivo es el que se le pasa al motor, una línea que pida MÁS que ese umbral falla
-- sola en el filtro de `evaluate_property_options` (`coalesce(p_residency_years,0) >= min_...`).
-- La garantía la da el motor, no una constante nuestra.
--
-- SUPUESTO QUE SÍ SE ACEPTA, con su razón (Andrea, 2026-08-02): que una MISMA provincia tenga dos
-- líneas con mínimos distintos es muy poco probable — la residencia la piden los gobiernos
-- provinciales, no los bancos. Si igual pasara, se pregunta por el menor y la línea más exigente
-- queda afuera: se pierde una línea que quizá calificaba (recuperable) en vez de prometer uno que
-- no (irrecuperable, que es el bug 6962).
--
-- Candado: `XIMIA/scripts/test_premise_guard.py --live`.

begin;

alter table public.leads
  add column if not exists residency_years_required integer;

comment on column public.leads.residency_years_required is
  'Umbral de residencia (en años) contra el que se respondió meets_residency, tomado de '
  'banks_financing para la provincia del lead en el momento de preguntar. '
  'Si deja de coincidir con el umbral vivo de esa provincia, la respuesta está VENCIDA y Ximia '
  'vuelve a preguntar en vez de reinterpretarla. NULL = todavía no se preguntó. '
  'Candado: XIMIA/scripts/test_premise_guard.py';

comment on column public.leads.meets_residency is
  'Cumple el mínimo de residencia EXIGIDO EN SU PROVINCIA (ver residency_years_required, que dice '
  'cuál era ese mínimo al preguntar). Hoy sólo lo pide Neuquén Habita/ADUS: 5 años. '
  'SÍ/NO entendido por el agente a partir de lo que la persona dijo — "hace 8 años", "toda la vida", '
  '"nací acá" y "desde los 80" son todos el mismo SÍ; el agente NO produce un número. '
  'NULL = nadie lo dijo todavía (no es "no cumple"). '
  'Ximia NO escribe residency_years: ese campo sigue siendo del OCR de las fichas del sindicato.';

commit;

-- Impacto en los 380 leads actuales: cero. La columna nace NULL.
-- Después de correr: python3 scripts/test_premise_guard.py --live   (en ~/Projects/XIMIA)

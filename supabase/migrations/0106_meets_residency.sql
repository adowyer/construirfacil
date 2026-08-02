-- 0106_meets_residency.sql
--
-- X-02a (auditoría 2026-08-01) — LA RESIDENCIA SE GUARDA COMO SÍ/NO, NO COMO UN NÚMERO INVENTADO
--
-- QUÉ PASÓ
-- --------
-- En la charla auditada la compradora dijo *"vivimos en Neuquén de toda la vida"* y el agente llamó
-- a la tool con `residency_years: 30`. Nadie dijo 30. Es una premisa inventada — de la misma familia
-- que el `first_home: true` que le costó a esa conversación un crédito 72% más alto del que
-- correspondía.
--
-- Esa vez no cambió el resultado (30 y "toda la vida" cruzan igual el umbral). Pero el mecanismo es
-- el mismo, y con otro número cruza el umbral al revés.
--
-- LA DECISIÓN (Andrea, 2026-08-01)
-- --------------------------------
-- El agente **no tiene que producir un número**. Lo único que decide el número es un umbral, así que
-- lo que se captura es un SÍ/NO: *"¿hace 5 años o más que viven en la provincia?"*.
-- Eso elimina la invención de raíz: no hay precisión que fabricar.
--
-- Verificado antes de decidirlo: de las **7 líneas de `banks_financing`, UNA SOLA** tiene mínimo de
-- residencia — Neuquén Habita (ADUS), 5 años. Las otras seis tienen `min_residency_years` NULL.
--
-- ⚠️ EL SUPUESTO QUE ESTO INTRODUCE, Y SU CERRADURA
-- --------------------------------------------------
-- Colapsar a un booleano es correcto **mientras el único mínimo sea 5**. Si alguien carga mañana una
-- línea que pida 10 años, el sí/no seguiría diciendo "cumple" y **nadie se enteraría** — que es
-- exactamente la falla que originó `docs/DECISIONES.md` (una regla cierta hoy, convertida en
-- supuesto invisible mañana).
--
-- Por eso va con assert, no con comentario: `XIMIA/scripts/test_premise_guard.py` afirma contra la
-- base viva que ningún `banks_financing.min_residency_years` es distinto de 5 o NULL. El día que
-- alguien cargue otra cosa, el test explota y avisa que el sí/no dejó de alcanzar.
--
-- `residency_years` NO se toca ni se deprecia: sigue siendo la fuente para los leads del sindicato,
-- donde el número viene del OCR de las fichas y es un dato real. Lo que cambia es que **Ximia deja
-- de escribirlo**: guarda `meets_residency` y nada más.

begin;

alter table public.leads
  add column if not exists meets_residency boolean;

comment on column public.leads.meets_residency is
  'Cumple el mínimo de residencia en la provincia (hoy: 5 años, sólo lo pide Neuquén Habita/ADUS). '
  'SÍ/NO capturado por el Extractor determinístico de Ximia a partir de lo que la persona dijo — '
  'entiende tanto "hace 8 años" como "toda la vida"/"nací acá"/"desde los 80". '
  'NULL = nadie lo dijo todavía (no es "no cumple"). '
  'Ximia NO escribe residency_years: ese campo sigue siendo del OCR de las fichas del sindicato. '
  'Candado del supuesto "el único mínimo es 5": XIMIA/scripts/test_premise_guard.py';

commit;

-- Impacto en los 388 leads actuales: cero. La columna nace NULL.
-- Después de correr: python3 scripts/test_premise_guard.py   (en ~/Projects/XIMIA)

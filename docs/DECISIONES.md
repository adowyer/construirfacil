# Decisiones cerradas — registro append-only

> **Qué es esto.** Cada entrada es una decisión de negocio **ya tomada**, con su razón y el lugar
> exacto donde vive en el sistema. Una decisión cerrada **no se revierte en silencio**.
>
> **Antes de escribir una migración que CAMBIE un valor existente** (distinto de agregar uno nuevo),
> buscá acá. Si el valor figura, no se toca sin preguntar: hay que citar la decisión previa y la
> fuente nueva, y esperar respuesta explícita. Un dato nuevo que contradice una decisión **no la
> deroga** — abre una pregunta.
>
> **El candado real no es este archivo.** Es `scripts/test_conformidad.sql`, que afirma estos
> valores y falla si alguien los mueve. Este archivo explica el *por qué*; el test *impide*.
> Toda entrada de acá debería tener su assert allá.
>
> Nunca marcar un cambio como "confirmado" salvo que Andrea haya confirmado **ese** cambio.
> No vale la confirmación de un valor vecino.

---

## Por qué existe este archivo — el caso que lo originó

**2026-07-20.** La migración `0058` bajó la tasa ADUS de 2% a **6%** como política conservadora
(*"no acredita haberes en BPN"*) y lo dejó anotado en un comentario SQL. Dieciocho migraciones más
tarde, la `0076` la devolvió a **2%** leyendo ese 6 como *"override stale de 0058"*, citando una
planilla — y se rotuló *"único cambio confirmado"* bajo un encabezado donde lo que Andrea había
confirmado era la tabla del Banco Provincia del Neuquén, **otra línea distinta**.

Consecuencia: **40 créditos de la tanda del sindicato cotizados ~29% de más**, comunicados por mail.

El comentario de advertencia existía. No frenó nada. Por eso el candado vive en un test.

Andrea, 2026-07-20: *"Para mí una decisión tomada no tiene regresión... Si algo va a cambiar lo que
estaba decidido debe ser preguntado puntual y claramente."*

---

## D-001 · Tasa ADUS: 6% (UVI + 6% TNA)

- **Decidido:** 2026-07-20 (reafirma la decisión original de `0058`, revertida por error en `0076`).
- **Vive en:** `banks_financing.interest_rate` donde `bank_name='Neuquén Habita'`.
- **Valor:** `6`.
- **Razón:** el programa da UVI+2% **solo si el solicitante acredita haberes en el Banco Provincia
  del Neuquén**; UVI+6% en caso contrario. No podemos verificarlo masivamente, así que tomamos el
  peor caso. Criterio de Andrea: *"aplicar siempre la tasa más alta para ajustar después"*.
  Subcotizar y corregir hacia arriba es recuperable; prometer y bajar 29% no lo es.
- **Fuente:** `banks_financing.requirements_text` de la propia línea, que dice literalmente
  *"UVI + 2% TNA si acredita haberes en el Banco Provincia del Neuquén; UVI + 6% TNA en caso
  contrario (tomamos 6% por defecto)"*.
- **Para reabrir:** hace falta confirmar dónde cobra la persona. Se pregunta **una por una en las
  llamadas** (decisión de Andrea: no se puede averiguar globalmente). Si a futuro se captura el
  dato, la tasa pasa a depender del lead y esta entrada se reemplaza — no se edita en silencio.

## D-002 · ADUS es vivienda única — se lee `first_home`, nunca se hardcodea

- **Decidido:** 2026-07-18.
- **Vive en:** `banks_financing.destination='vivienda_unica'` + el `case` sobre `l.first_home` en
  `scripts/qualify_leads.sql`.
- **Razón:** el programa está *"dirigido a personas y grupos familiares que no posean vivienda
  previa"*. `qualify_leads.sql` tenía `'primera_vivienda'` hardcodeado y nunca leía el campo →
  7 leads cotizados 40-50% de más.
- **Sin dato → `segunda_vivienda`** (conservador) + marca `needs_review`. Nunca asumir que sí.

## D-003 · El tope de ingreso ADUS es FAMILIAR

- **Decidido:** origen `0058`; reafirmado 2026-07-20 al encontrar la divergencia.
- **Vive en:** `banks_financing.max_household_income_ars = 6500000`.
- **Razón:** el requisito dice *"ingreso neto máximo del **grupo familiar**"*. El tool de n8n
  `evaluate_financing` ya sumaba `monthly_income_ars + partner_income_ars`; `qualify_leads.sql`
  pasaba solo el individual → daba ADUS a quien supera el tope sumando al cónyuge.
- **Siempre** `coalesce(monthly_income_ars,0) + coalesce(partner_income_ars,0)`.

## D-004 · Escritura: requisito BLANDO — avisa, no excluye

- **Decidido:** 2026-07-20 (Andrea).
- **Vive en:** una marca en `profile_json` de `scripts/qualify_leads.sql`. **NO** es filtro del motor
  y **NO** lleva columna en `banks_financing`.
- **Razón:** ADUS exige *"escritura del inmueble a nombre del solicitante"*, pero es un requisito
  **resoluble**: las asesoras y el equipo contable acompañan a la persona a regularizarlo. Excluir
  por falta de escritura mataría gente que sí puede llegar. Andrea: *"dejémoslo blando... se van a
  ocupar de ver cómo ayudarlos a resolver eso"*.
- **Medido antes de decidir:** como filtro duro, el RADAR caía de 280 a **13** personas
  (USD 25,3M → 1,1M). Sólo 24 leads de 374 tienen `has_escritura=true`. Insostenible como filtro.
- **Regla:** `has_escritura` distinto de `true` → marca visible para la asesora, el crédito se
  calcula igual.

## D-005 · Edad ADUS 18–65 — se calcula desde `fecha_nacimiento`, nunca se lee `age`

- **Decidido:** 2026-07-20.
- **Vive en:** `banks_financing.min_age` / `max_age` + cálculo en el caller.
- **Razón:** requisito 1 del programa. Hoy **no excluye a nadie por edad real** (todos están en
  actividad, como anticipó Andrea) pero la condición existe y tiene que estar modelada.
- **`leads.age` está vacía en las 374 filas y no se mantiene sola.** No se usa nunca: la edad se
  deriva siempre de `fecha_nacimiento`.
- **Sin fecha, o fecha imposible → `needs_review`, NO se excluye.** Ver D-007: hay fechas basura.

## D-008 · Supabase ↔ HubSpot: propiedad de campos, NO sync bidireccional

- **Decidido:** 2026-07-18 (sábado).
- **Tarjeta:** https://trello.com/c/epoPaPxd/72-supabase-%E2%86%94-hubspot-repartir-propiedad-de-campos-no-sync-bidireccional
- **Razón:** un sync bidireccional entre dos bases vivas termina en conflictos de escritura que
  nadie puede arbitrar. Cada campo tiene **un solo dueño**; el otro sistema lo lee, no lo pisa.
- **Estado al 2026-07-20: NO IMPLEMENTADO.** Verificado por grep: los únicos archivos que tocan
  HubSpot (`scripts/hubspot_props.py`, `scripts/send_engagement.py`) escriben **hacia** HubSpot.
  **No existe ningún camino de vuelta.**
- **Consecuencia concreta, medida hoy:** Andrea corrige DNI y datos a mano en HubSpot (es la base
  viva de las asesoras) y esas correcciones **nunca llegan a Supabase**, que es de donde el motor
  calcula los créditos. Se cotiza con datos que ya sabemos que están mal.
- Es la misma clase de problema que D-001: **dos fuentes de verdad que divergen en silencio.**
  La diferencia es que acá lo sabemos desde el principio y falta construir la ruta.

## D-007 · Fechas de nacimiento basura — no excluir por un error de ingesta

- **Decidido:** 2026-07-20.
- **Razón:** al modelar la edad aparecieron 8 leads con `fecha_nacimiento` que da 0, −1, 1 y 16
  años — es decir, años de nacimiento 2026/2027. Es **corrupción de la ingesta OCR de las fichas**,
  no gente fuera de rango. Ningún lead de la base tiene más de 65.
- **Regla:** una edad fuera de `[18,65]` **derivada de una fecha imposible** (nacimiento posterior a
  hoy − 17 años) se trata como **sin dato** → `needs_review`, no como rechazo. Rechazar a alguien
  por un error nuestro de OCR es el peor error posible.
- **Pendiente separado:** auditar la ingesta OCR de `fecha_nacimiento`. Es un bug de ingesta y se
  arregla ahí, no en la calificación. 1 de los 40 contactados (Gonzalez Ricardo Ulises) directamente
  no tiene fecha cargada.

## D-009 · Legajo Nro. — Letra + 5 dígitos, CONGELADO

- **Decidido:** 2026-07-21 (Andrea).
- **Vive en:** `leads.legajo_nro` + `public.emitir_legajos()` + secuencia `legajo_seq`
  (migración `0101`). Candado: trigger `trg_legajo_inmutable` + CHECK de formato + índice único.
- **Formato:** 6 caracteres. `A` lote+anticipo · `B` lote sin anticipo · `C` sin lote con anticipo ·
  `D` ninguno. Número correlativo **global** de 5 dígitos desde **00050** (arranca en 50, no en 1).
- **CONGELADO:** emitido una vez, no cambia nunca. Si después consigue el lote, sigue siendo
  `D00050`. La letra dice **cómo entró**, no cómo está hoy. Razón: el legajo es una identidad —
  se anota en un cuaderno, se dice por teléfono, se manda por mail; un identificador que muta deja
  huérfano todo lo escrito antes. La situación actual se lee de `has_lot`/`has_anticipo`.
  Descartada la alternativa "reemitir".
- **Alcance:** `sindicato_uocra` + `web_form`. Andrea, 2026-07-21: *"debemos empezar a llamar también
  a esos"*. Queda afuera `web_chat` (pruebas del lab, no son personas).
- **Sin `has_lot` o sin `has_anticipo` → NO se emite legajo.** La letra no se inventa. Se emite solo
  en cuanto la asesora carga el dato, volviendo a llamar a `emitir_legajos()` (es idempotente).
- **`has_anticipo` NO se deriva de `savings_amount`** — medido 2026-07-21: de 300 leads con el
  booleano cargado, 8 no coinciden con "monto > 0", y **7 de esos 8 tienen `has_anticipo=true` con
  el monto vacío** (dijeron que tienen anticipo sin declarar cuánto). Derivarlo les cambiaría la
  letra por un dato que nunca dieron. Además 65 de los 74 sin booleano tampoco tienen monto: la
  derivación ni siquiera resolvía el problema. Descartada por evidencia.
- **Nunca a mano.** Todo legajo sale de `emitir_legajos()`. Un legajo cargado en una planilla o en
  HubSpot se desincroniza — la misma clase de falla que D-001.
- **Propiedad (D-008):** lo emite **Supabase**; HubSpot lo lee. `sync_hubspot_to_supabase.py` no
  debe listarlo jamás.

## D-006 · Alcance declarado: qué NO pre-califica Ximia

- **Decidido:** 2026-07-20.
- **Razón:** de los 13 requisitos ADUS, los que producen un **número incorrecto** se modelan
  (1–8). Los 9–12 son verificación documental que hace ADUS con los papeles a la vista y se
  declaran **fuera de alcance de forma explícita**: RUPROVI 2.0, deudor alimentario moroso,
  registro de violencia familiar, crédito ADUS vigente. El 13 (garantía hipotecaria + seguros)
  no es filtro de calificación.
- **Criterio:** una herramienta que dice qué **no** sabe genera más confianza que una que promete
  todo. Esto se comunica tal cual en la presentación a ADUS.

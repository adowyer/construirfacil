# 🚨 Auditoría de calificación crediticia — 2026-07-18

> **Estado: ABIERTO. Nada corregido todavía salvo un bug (arreglado, NO ejecutado).**
> Este documento existe para que mañana se **decida**, no para volver a descubrir.
>
> **DOS COSAS ESTÁN BLOQUEADAS HASTA RESOLVER ESTO:**
> 1. **NO calificar los ~281 leads restantes** del sindicato. Si se corren hoy, heredan todos
>    los errores de abajo y se multiplica el problema por 7.
> 2. **NO correr `scripts/qualify_leads.sql`** sobre los 40 ya contactados hasta confirmar
>    `first_home` con las 7 personas afectadas (ver §2).
>
> Contexto: la semana del 2026-07-20 hay oportunidad de presentar **Ximia a ADUS** como
> herramienta de calificación. De ahí la urgencia de la exactitud.

---

## 1. Cómo apareció esto (y por qué importa el cómo)

Apareció **por casualidad**. Armando una tabla de llamadas ordenada por crédito, dos filas no
seguían la curva. Si la tabla hubiera salido ordenada por nombre, hoy nadie lo sabría.

**No existe ningún control que valide el resultado del motor contra las condiciones del producto.**
Esa es la falla de fondo; los bugs concretos son síntomas.

Y es la **segunda vez** que pasa lo mismo. `XIMIA/docs/HANDOFF_2026-06-02.md` documenta:
*"la Financial Query no le pasa la provincia a la función → no puede geo-gatear"*. Mismo patrón:
**un caller que no le pasa un dato a un motor que sí sabe evaluarlo.** No es mala suerte.

### ✅ La buena noticia (importante para la reunión con ADUS)

**El agente Ximia está BIEN.** El tool `evaluate_financing` (n8n `LwnfZHvjJXO9EAJ7`, activo) hace
lo correcto:

```js
first_home === true ? 'primera_vivienda' : first_home === false ? 'segunda_vivienda' : null
Number((monthly_income_ars || 0) + (partner_income_ars || 0))   // ingreso FAMILIAR
```

Y tiene un guard que **se niega a calcular** si falta `first_home` (GOLDEN RULE: garantía en código).

**El bug nunca estuvo en el motor SQL ni en el agente.** Estuvo en `qualify_leads.sql`, el script
batch, que es una **segunda implementación** del mismo criterio y se desincronizó del tool bueno.

---

## 2. Bug confirmado y ARREGLADO (no ejecutado) — `first_home` / ADUS

**Causa:** `qualify_leads.sql` tenía `'primera_vivienda'` **hardcodeado** (líneas 24 y 35) y nunca
leía `leads.first_home`. El ADUS es `vivienda_unica` → *"dirigido a quienes NO posean vivienda previa"*.
Resultado: ADUS (2%, 20a) a gente que corresponde Banco Nación Segunda Vivienda (12%, 30a).

**Arreglado en `6545d35`** (case sobre `first_home`; null → `segunda_vivienda` conservador +
marca `needs_review`). **NO EJECUTADO** — hay un bloque `🚨 NO CORRER SIN LEER ESTO` al tope del script.

### Los 7 afectados — ya recibieron el mail con la cifra alta

| Nombre | Teléfono | Enviado | Correcto | Listado | |
|---|---|---|---|---|---|
| Margarita Matto | 2994527870 | 121.504 | 70.821 | (sin dato) | ✅ verificó |
| Ariel Gomez | 2995072342 | 49.669 | 24.144 | Listado5 | ✅ verificó |
| Anahí Viedma | 2994240050 | 99.338 | 48.287 | Listado25 | |
| Marcelo Mulbayer | 2995536497 | 99.338 | 51.506 | Listado18 | |
| Natalia Gutiérrez | 2996309057 | 78.546 | 32.192 | Listado4 | |
| Graciela Serna | 2993294383 | 74.619 | 30.582 | Listado13 | |
| Wanda Zumelzu | 2993295842 | 99.338 | 45.068 | Listado8 | ⚠️ `first_home` SIN DATO |

Dispersos en 6 listados ⇒ transversal, no un PDF mal leído. **Saso y Sepúlveda están correctas**
(eran las dos que no seguían la curva y destaparon todo).

**Decisión de Andrea (2026-07-18): preguntar ANTES de recalcular.** La vivienda previa puede no estar
a nombre de la persona → varias podrían sí calificar. Recalcular primero obligaría a una segunda
corrección hacia arriba que ya nadie creería.

**Ya hecho:** los 7 marcados en HubSpot con la propiedad nueva **`🏠 ¿Vivienda previa a su nombre?`**
en `⚠️ A CONFIRMAR — no dar monto`. Opciones: `a_confirmar` / `si_a_su_nombre` (NO califica) /
`si_no_a_su_nombre` (sí) / `no_tiene` (sí).
**Pendiente de Andrea:** agregar esa columna a la vista de las asesoras.

**Colateral:** 13 leads en toda la base con `qualifies_adus_with_lot=true` y `first_home=false`.
El RADAR de negociación de tierra queda inflado ~2% (USD 537k sobre 22,1M) — el argumento de
"244 con demanda lista" se sostiene, pero el número no es exacto.

---

## 3. 🔴 LO MÁS GRAVE — sin resolver: la tasa del ADUS

`banks_financing.requirements_text` (cargado por nosotros) dice:

> *"UVI + 2% TNA si acredita haberes en el Banco Provincia del Neuquén; UVI + 6% TNA en caso
> contrario **(tomamos 6% por defecto)**"*

**Pero `banks_financing.interest_rate = 2`.** La tabla contradice a su propia documentación.

| | @ 2% (lo que usamos) | @ 6% (el default declarado) |
|---|---|---|
| Ingreso $2,0M | USD 78.546 | **USD 55.463** |
| Ingreso $3,0M | USD 99.338 | **USD 70.144** |

Factor de anualidad 20 años: 197,67 @2% vs 139,58 @6% → **el crédito cae 29,4%**.

**Alcance: TODAS las cotizaciones ADUS, no 7.** Las 33 restantes de la tanda y los ~281 sin calificar.

**❓ DECISIÓN PENDIENTE:** ¿los afiliados del sindicato cobran haberes por Banco Provincia del Neuquén?
- **Si sí** → el 2% está bien y hay que corregir el `requirements_text`.
- **Si no** → hay que poner 6% y **toda la tanda está 29% sobrecotizada**.
- **Si depende** → hace falta capturar el dato (¿dónde cobra?) y que el motor elija la tasa.

---

## 4. Auditoría: 13 requisitos ADUS vs. lo que el sistema verifica

Fuente: `banks_financing.requirements_text` de Neuquén Habita (texto completo en la tabla).

| # | Requisito | Estado | Nota |
|---|---|---|---|
| 1 | Vivienda única (no poseer previa) | ⚠️ | regla OK; se perdía en el script → §2 |
| 2 | Residencia 5 años en Neuquén | ✅ | `min_residency_years=5` |
| 3 | Cuota ≤ 30% ingreso familiar | ✅ | `rci=0.30` |
| 4 | Ingreso familiar ≤ $6.500.000 | ⚠️ | agente suma cónyuge, **script NO** → §5 |
| 5 | Construcción ≤ 90 m² | ✅ | `max_area_m2=90`; catálogo entra (mín 43,56 m²) |
| 6 | **Escritura a nombre del solicitante** | ❌ | **no se verifica** — 24 de 40 sin escritura |
| 7 | **Edad 18–65** | ❌ | **no existe la condición** en `banks_financing` |
| 8 | **Tasa 2% vs 6%** | 🔴 | § 3 |
| 9 | Inscripción RUPROVI 2.0 | ❌ | no se captura |
| 10 | No deudor alimentario moroso | ❌ | no se captura |
| 11 | No en registro de violencia familiar | ❌ | no se captura |
| 12 | No tener crédito ADUS vigente | ❌ | no se captura |
| 13 | Garantía hipotecaria + seguros | ➖ | no es filtro de calificación |

**Criterio de Andrea:** *"no son importantes las 13, muchas se ven al evaluar los papeles"*.
Los candidatos a modelar son **6, 7 y 8** (dan un número incorrecto). Los 9–12 son verificación
documental de ADUS y se pueden declarar fuera de alcance explícitamente.

---

## 5. Segundo bug encontrado, NO arreglado — ingreso familiar

El tope ADUS es de **ingreso del grupo familiar**. `qualify_leads.sql` pasa solo
`l.monthly_income_ars` e **ignora `partner_income_ars`**. El tool de n8n sí los suma.

Doble efecto, en direcciones opuestas:
- **RCI** sobre ingreso individual → subestima capacidad (subcotiza).
- **Tope de 6,5M** sobre ingreso individual → sobrestima elegibilidad (**da ADUS a quien no debe**).

**Casos reales encontrados** (solos pasan el tope, juntos lo superan):

| Nombre | Individual | Cónyuge | Familiar | ADUS marcado |
|---|---|---|---|---|
| Sotorzo Adriano | 3.500.000 | 4.000.000 | 7.500.000 | ✔ sí (mal) |
| Pablo Daniel Montes | 4.800.000 | 2.500.000 | 7.300.000 | ✔ sí (mal) |
| Damián Barroso | 4.000.000 | 3.000.000 | 7.000.000 | ✔ sí (mal) |
| Marta Sepúlveda | 3.000.000 | 5.000.000 | 8.000.000 | — |

41 leads en la base tienen ingreso de cónyuge cargado; 5 están en la tanda de 40.

**Arreglo (1 línea, sin hacer):** en `qualify_leads.sql`, reemplazar `l.monthly_income_ars` por
`coalesce(l.monthly_income_ars,0) + coalesce(l.partner_income_ars,0)` — igual que el tool de n8n.

---

## 6. Escritura — el dato está, nadie lo mira

ADUS exige **escritura del inmueble a nombre del solicitante**. `banks_financing.requires_own_lot=true`
chequea `has_lot`, pero **`leads.has_escritura` no se usa en ningún filtro**.

**24 de los 40 contactados** tienen lote pero `has_escritura` en `false` o vacío — incluido Ramón
Rivero, que fue cotizado ADUS con `has_escritura=false`.

Es el más barato de arreglar: el dato ya se captura, es binario, y falta una columna
`requires_deed` en `banks_financing` + el filtro en el motor.

---

## 7. Cómo evitar que se repita (la parte estructural)

Lo de hoy no se encontró leyendo código: se encontró **comparando dos implementaciones del mismo
criterio**. Donde discrepan, una está mal. Eso se puede automatizar.

1. **Test de conformidad por línea de crédito.** Casos con resultado esperado escrito a mano:
   *"58 años, sin escritura, ingreso 2M + cónyuge 5M → NO debe dar ADUS"*. Corre en segundos y falla
   ruidosamente cuando alguien toca el motor o agrega un caller. **Hoy no existe nada de esto.**
2. **Una sola fuente del criterio.** Hoy hay dos (tool n8n ✅ / `qualify_leads.sql` ❌). Mientras sean
   dos van a divergir otra vez. El batch debería llamar a la misma lógica, no reimplementarla.
3. **Chequeo de cobertura tabla ↔ requisitos.** Los requisitos 7–12 no tienen ni columna donde vivir.
   Decidir cuáles se modelan y cuáles se declaran fuera de alcance.

---

## 8. Para la presentación a ADUS — recomendación

No hacen falta los 13 requisitos, y no da el tiempo. Lo que sí:

- **Arreglar lo que produce un número incorrecto:** tasa (§3), ingreso familiar (§5), escritura (§6).
- **Ser explícita sobre el alcance:** *"Ximia pre-califica sobre N de los 13 requisitos; los restantes
  son verificación documental de ADUS"*. Una herramienta que dice qué **no** sabe genera más confianza
  que una que promete todo.
- **Mostrar el guard del agente** (se niega a calcular sin `first_home`). Es exactamente lo que un
  organismo quiere ver de una herramienta de terceros.

---

## 9. Orden sugerido para mañana

| # | Qué | Quién | Bloquea |
|---|---|---|---|
| 1 | **Decidir la tasa ADUS: 2% o 6%** | Andrea | todo lo demás |
| 2 | Confirmar `first_home` con las 7 (llamada) | asesoras | recalcular |
| 3 | Arreglar ingreso familiar en el script | Claude | calificar los 281 |
| 4 | Decidir si se modela escritura y edad | Andrea | " |
| 5 | Correr `qualify_leads.sql` (todo junto, una sola vez) | Claude | " |
| 6 | Test de conformidad | Claude | — |
| 7 | Definir alcance declarado para ADUS | Andrea | presentación |

**Regla que ordena todo esto: una sola corrección, no tres.** Cada recálculo mueve montos que las
asesoras ya comunicaron. Juntar las decisiones 1, 3 y 4 y correr el script **una vez**.

# Taxonomía canónica de leads (multi-canal)

> Modelo de clasificación de leads **reutilizable para TODOS los canales** (UOCRA / web_chat /
> web_form / referido / futuros). Cualquier source nuevo se mapea a estos ejes; nada acá es
> específico de un programa. Acordado con Andrea 2026-06-13.

## Principio rector: HECHOS atómicos vs VEREDICTO derivado

Es la GOLDEN RULE aplicada a los datos:

- **HECHOS** = atómicos, ortogonales, universales. Se capturan igual venga de donde venga. **Nunca
  cambian de significado.** Un canal llena lo que captura; el resto queda `null` (válido).
- **VEREDICTO** = derivado de los hechos por el motor (que puede variar por programa/canal).
  **Reemplazable sin re-etiquetar ningún hecho.**
- En el CRM se guardan los dos, pero **se SEGMENTA por hechos** (universal) y **se ACCIONA por
  veredicto** (por-programa).

⚠️ **Anti-patrón a evitar:** etiquetas que mezclan hecho + veredicto + programa, ej.
`blocker = "Falta lote — califica ADUS provincial (UVI 2%)"`. Eso no transfiere a otro canal/programa.
Se descompone en: hecho (`has_lot=false`) → `blocker_code='tierra'` → `programa_recomendado='ADUS UVI 2%'`.

## Identidad cross-canal

- **`dni` = clave de persona universal.** Misma persona por dos canales = **un solo lead** (merge por DNI).
  Es el identificador de dedup en HubSpot (no el email, que falta/no es único).
- **`source`** = canal de origen (`uocra` / `web_chat` / `web_form` / …). Siempre se captura.
- Primer/último contacto para lifecycle.

## Los 8 ejes

### HECHOS (capturados)
**Eje 1 — Tierra** (un atributo, valores excluyentes): `sin_lote` · `con_lote_sin_escritura` ·
`con_lote_con_escritura`. *(Deriva de `has_lot` + `has_escritura`.)*

**Eje 2 — Refuerzo crediticio:** codeudor sí/no (`codeudor`) · anticipo sí/no (`has_anticipo`) +
monto (`savings_amount`, = capacidad/cash que TIENE).

**Eje 3 — Perfil laboral:** `dependencia_efectivo` · `dependencia_temporario` · `autónomo` ·
`informal` (`employment_type` + `contract_type`) + antigüedad en bandas (`job_tenure_months`:
<6m / 6-12m / 1-3a / 3a+).

**Eje 4 — Vivienda:** `primera_vivienda` sí/no (`first_home`).

**Eje 8 — Intención / Compromiso** *(la mitad INTENT del scoring):*
- **`horizonte_compra`**: `3_meses` · `6_meses` · `12_meses` · `+12m` · `sin_definir`. Señal de
  urgencia **Y driver de precio** (ver regla abajo). El form web lo pregunta; UOCRA = null.
- **Seña** (compromiso de reserva, **≠ anticipo**): `sena_dispuesto` (sí/no) + `sena_monto`. Señal
  de conversión / fondo de embudo. (Todavía no se pregunta — campo reservado.)
- A futuro: señales de engagement del chat (Sales Radar: intención/sentimiento/objeción).

### VEREDICTO (derivado por el motor)
**Eje 5 — Capacidad:** `califica` / `califica_condicionado` / `no_califica` · `cubre_mínima` sí/no.

**Eje 6 — Veredicto:**
- `bucket`: `listo` / `listo_bloqueado` / `califica_después` / `no_fit`.
- **`blocker_code`** (enum atómico): `tierra` · `escritura` · `codeudor` · `ingreso` · `ahorro` ·
  `consentimiento` · `dato` · `ninguno`.
- **`programa_recomendado`** (texto): el detalle que varía por programa (ADUS UVI 2%, banco X…) →
  campo aparte, reemplazable.

### OPERATIVO (universal CRM)
**Eje 7:** consentimiento (`status`/Ley 25.326) · contactabilidad (tiene tel/mail) · completitud de
dato · `needs_review` + razones (`dni≠cuil`, inconsistencias, ilegible…).

## Regla de dominio: urgencia → precio

`horizonte_compra` selecciona el **tier de precio** (los 3 tiers ya existentes — ver CLAUDE.md):

| `horizonte_compra` | Tier | |
|---|---|---|
| `3_meses` (YA) | `precio_lista` | el más alto (entrega inmediata) |
| `6_meses` | `precio_contado` = **CUPO** | precio base |
| `12_meses` | `precio_pozo` | el más barato |

**Consecuencia (pendiente de cablear en el motor):** hoy el motor calcula affordability siempre contra
`precio_contado`. Debe pricear contra el tier que implica el plazo. Dinámica de venta: *más rápido =
más caro = FIT más difícil, pero INTENT más caliente* → mostrar el trade-off al lead
("3 meses a $X vs 12 meses a precio pozo $Y").

## Scoring: FIT × INTENT

`lead_score = FIT (readiness + capacidad) × INTENT (urgencia + compromiso)`.
- **FIT** = ejes 1-5 (tiene lote, califica, cubre mínima, ahorro, estabilidad laboral).
- **INTENT** = eje 8 (horizonte_compra, seña, engagement).
- Leads sin INTENT (ej. UOCRA papel) → degradan limpio a score de capacidad. Leads web con
  horizonte/seña → score más rico. La fórmula referencia campos que pueden ser null por canal, sin romperse.

## Mapeo a columnas

**Ya existen** (`leads`): `dni`, `source`, `has_lot`, `has_escritura`, `codeudor`, `has_anticipo`,
`savings_amount`, `employment_type`, `contract_type`, `job_tenure_months`, `first_home`, `bucket`,
`qualifies`, `status`.

**Agrega `0083_leads_taxonomy_fields.sql`:** `horizonte_compra`, `sena_dispuesto`, `sena_monto`,
`blocker_code` (enum), `programa_recomendado`. El `blocker` de prosa queda **deprecado** en favor de
`blocker_code` + `programa_recomendado`.

## Follow-ups

1. **`qualify_leads.sql`**: que escriba `blocker_code` (atómico) + `programa_recomendado` (en vez del
   `blocker` de prosa).
2. **Motor tier-aware**: usar `horizonte_compra` para elegir el tier de precio en la affordability.
3. **Form web**: agregar la pregunta de seña cuando se decida pedirla.
4. **Score FIT×INTENT**: incorporar `horizonte_compra` + seña al `lead_score` cuando haya leads web.

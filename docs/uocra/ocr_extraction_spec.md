# OCR Extraction Spec — Forms UOCRA → `leads`

> **Estado: BORRADOR para revisar (Andrea).** Diseño del pipeline de Fase 1. NADA deployado.
> Base: lo aprendido extrayendo 3 forms reales (Marisa, Perla, Carla) el 2026-06-11.
> El extractor manual ya funciona; esto especifica la versión automatizable (n8n + Gemini Vision).

## Flujo
`foto del form` → **Gemini Vision** (extrae JSON) → **validación + flags** (Code) → **upsert `leads`** (dedup por DNI) → revisión humana solo de lo flageado.

## 1. Prompt de extracción (Gemini Vision)
Instrucción (sistema): *"Sos un extractor de datos de un formulario de relevamiento habitacional manuscrito (UOCRA / ConstruirFácil). Devolvé SOLO un JSON con los campos indicados. Para checkboxes, devolvé la opción tildada. Campo vacío o ilegible → `null`. NO inventes. Para DNI, CUIL y sueldos (alto riesgo) transcribí EXACTAMENTE lo escrito; si dudás, igual transcribí y marcá el campo en `_low_confidence`."*

## 2. Schema de salida (JSON) → columnas `leads`
| Campo JSON | Tipo | → `leads` | Notas |
|---|---|---|---|
| `nombre_apellido` | str | `name` | |
| `dni` | str (solo dígitos) | `dni` | validar contra CUIL |
| `cuil` | str `XX-XXXXXXXX-X` | `cuil` | |
| `fecha_nacimiento` | date | `fecha_nacimiento` | formato AR `dd/mm/aa(aa)` → ISO |
| `estado_civil` | str | `estado_civil` | |
| `celular` | str (dígitos) | `phone` | |
| `mail` | str | `email` | lowercase |
| `tiene_terreno` | bool | `has_lot` | |
| `tiene_escritura` | bool | `profile_json.escritura` | |
| `interesa_terreno_casa` | bool | `profile_json.casa_terreno` | |
| `primera_vivienda` | bool | `first_home` | |
| `residencia_5_anios` | bool | `residency_years` | true → `5` (≥5 comprobable) |
| `alquila` | bool | `alquila` | |
| `monto_alquiler` | num | `alquiler_amount` | |
| `sueldo_neto` | num | `monthly_income_ars` | ⚠️ ver normalización |
| `antiguedad` | str | `profile_json.antiguedad` | "8 meses" / "2 años" |
| `tipo_contrato` | enum efectivo\|temporario | `employment_type` | efectivo→`employed`, temporario→`self_employed_simplified` (conservador) |
| `sueldo_conyuge` | num | `partner_income_ars` | |
| `conyuge_codeudor` | bool | `codeudor` | |
| `tiene_anticipo` | bool | — | si false → `savings_amount=0` |
| `monto_anticipo` | num | `savings_amount` | |
| `consentimiento` | bool | `consent_captured_at` | true → `now()` (o la fecha del form) |
| `fecha_firma` | date | `profile_json.fecha_firma` | |
| `delegado` | str | `delegado` | uso interno |
| `seccional` | str | `seccional` | uso interno |
| `_low_confidence` | str[] | `profile_json.needs_review` | campos dudosos |
| *(fijos)* | | `source='sindicato_uocra'`, `province='Neuquén'`, `savings_currency='ARS'`, `campaign_slug='UOCRA'` | |

## 3. Validación CUIL ↔ DNI (regla automática — aprendida de los 3 reales)
El **CUIL contiene el DNI** en el medio: `{27/20/23}-{DNI 8 díg}-{verificador}`.
- Si `dni == díg. del medio del CUIL` → **alta confianza** (resolvió sola la ambigüedad de DNI en los 3 reales).
- Si **difieren** → agregar a `needs_review` (uno de los dos se leyó mal).
- *(Opcional)* validar el dígito verificador del CUIL (módulo 11) → si no cierra, flag.

## 4. Normalización de sueldo (⚠️ la única ambigüedad real en los 3)
La gente escribe el sueldo de formas inconsistentes: `2.200.000`, `$3.500,000`, `POR MES 2.300` (← Perla: ¿2.300 o 2.300.000?).
- Heurística: si el número < 50.000 y el contexto es "sueldo mensual" → casi seguro está en miles/abreviado → **flag `needs_review`** en vez de adivinar.
- Nunca convertir a la fuerza; preferir el flag + confirmación humana (barato y seguro).

## 5. Dedup / upsert
- Clave natural = **`dni`**. Antes de insertar: `where not exists (select 1 from leads where dni=:dni)`.
- Si ya existe: UPSERT (mergear campos no nulos + acumular `needs_review`), NO duplicar.
- Idempotente: re-procesar la misma foto no crea otra fila.

## 6. Revisión humana (el "humano si es necesario" de Andrea)
- Solo se revisa lo flageado (`needs_review`), no cada form. En los 3 reales: **1 sola revisión** (el sueldo de Perla).
- Cola sugerida: `select name, dni, profile_json->'needs_review' from leads where source='sindicato_uocra' and profile_json ? 'needs_review';`

## 7. Decisión pendiente (Andrea)
- **Canal de ingreso de las fotos**: ¿cómo llegan al pipeline? WhatsApp (los delegados mandan) / upload web / Google Drive / mail. Define el trigger del workflow n8n. *(Hasta definirlo, el intake manual probado cubre las tandas.)*

## Credenciales (para el build)
- Gemini: `c7D8mhMIyOcsfyHp` (Google Gemini PaLM API) · Postgres: `fKGawTYDm3adKEbo`.

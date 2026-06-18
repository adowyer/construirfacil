# OCR Build Kit — núcleo del workflow UOCRA (Gemini + validación + upsert)

> Piezas listas para enchufar en n8n. El trigger Drive se cablea cuando esté la credencial.
> Grounded en los 78 forms reales (números en letras, casillas, sin-consentimiento, DNIs extranjeros).

## 1. Llamada a Gemini (HTTP Request → REST generateContent)
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
  *(auth: credencial "Google PaLM API" key del HTTP node; modelo flash-vision, barato).*
- **Body:** `contents[].parts` = `[ {inline_data:{mime_type:"application/pdf", data:<base64 del PDF>}}, {text:<PROMPT>} ]`
  + `generationConfig: { responseMimeType:"application/json", responseSchema:<SCHEMA>, temperature:0 }`

### PROMPT
```
Sos un extractor de datos de formularios manuscritos de relevamiento habitacional (UOCRA /
ConstruirFácil). El PDF tiene UN formulario por página. Devolvé un ARRAY JSON, un objeto por página.

Reglas:
- Para cada CASILLA (Sí/No), devolvé el valor TILDADO. Si ninguno está claro → null.
- Montos: devolvé SOLO el número entero en pesos. Si está escrito en letras ("dos millones",
  "seiscientos veinte mil") → convertilo. Si el formato es ambiguo o ilegible ("2.000.00",
  "1.500", "2500 x quincena") → igual poné tu mejor estimación PERO agregá el campo a
  low_confidence_fields.
- DNI y CUIL: transcribí exacto. El CUIL contiene el DNI en el medio (XX-DNI-Y); si el DNI no
  coincide con el medio del CUIL, agregá "dni" a low_confidence_fields.
- consentimiento = true SOLO si la casilla "Sí, autorizo" está tildada. Si no está tildada → false.
  (Es crítico: sin esto la persona no se puede cargar.)
- antiguedad_meses: convertí "X años Y meses" a meses totales.
- No inventes. Campo vacío → null.
```

### SCHEMA (responseSchema)
```json
{ "type":"array", "items":{ "type":"object", "properties":{
  "nombre_apellido":{"type":"string","nullable":true},
  "dni":{"type":"string","nullable":true},
  "cuil":{"type":"string","nullable":true},
  "fecha_nacimiento":{"type":"string","nullable":true},
  "estado_civil":{"type":"string","nullable":true},
  "celular":{"type":"string","nullable":true},
  "mail":{"type":"string","nullable":true},
  "tiene_terreno":{"type":"boolean","nullable":true},
  "tiene_escritura":{"type":"boolean","nullable":true},
  "interesa_casa_terreno":{"type":"boolean","nullable":true},
  "primera_vivienda":{"type":"boolean","nullable":true},
  "residencia_mas_5_anios":{"type":"boolean","nullable":true},
  "alquila":{"type":"boolean","nullable":true},
  "monto_alquiler":{"type":"number","nullable":true},
  "sueldo_neto":{"type":"number","nullable":true},
  "antiguedad_meses":{"type":"integer","nullable":true},
  "tipo_contrato":{"type":"string","nullable":true},
  "sueldo_conyuge":{"type":"number","nullable":true},
  "conyuge_codeudor":{"type":"boolean","nullable":true},
  "tiene_anticipo":{"type":"boolean","nullable":true},
  "monto_anticipo":{"type":"number","nullable":true},
  "consentimiento":{"type":"boolean","nullable":true},
  "fecha_form":{"type":"string","nullable":true},
  "delegado":{"type":"string","nullable":true},
  "seccional":{"type":"string","nullable":true},
  "low_confidence_fields":{"type":"array","items":{"type":"string"}}
}}}
```

## 2. Code node — validación + mapeo a columnas leads
- Parsear el array. Por form:
  - **CUIL↔DNI:** si `dni !== dígitos del medio del CUIL` → push 'dni' a low_confidence.
  - **Fechas:** `dd/mm/aa(aa)` → ISO. Año de 2 díg: 00-25→20xx si plausible para fecha_form; nacimiento con criterio.
  - **employment_type** (motor): siempre `'employed'` (relación de dependencia). `contract_type` = tipo_contrato.
  - **residency_years** = `residencia_mas_5_anios ? 5 : null`.
  - **has_anticipo** = tiene_anticipo; **savings_amount** = monto_anticipo; savings_currency='ARS'.
  - **consent_captured_at** = `consentimiento ? fecha_form (o now) : null`.
  - **status** = `consentimiento ? 'new' : 'pending_consent'`.
  - fijos: source='sindicato_uocra', campaign_slug='UOCRA', province='Neuquén'.
  - profile_json = el objeto crudo COMPLETO (+ low_confidence_fields).

## 3. Postgres — upsert (dedup por DNI)
```sql
insert into public.leads (source,campaign_slug,name,dni,cuil,phone,email,fecha_nacimiento,estado_civil,
  province,has_lot,has_escritura,interested_casa_terreno,first_home,residency_years,alquila,alquiler_amount,
  monthly_income_ars,job_tenure_months,contract_type,employment_type,partner_income_ars,codeudor,
  has_anticipo,savings_amount,savings_currency,consent_captured_at,form_date,delegado,seccional,
  profile_json,status)
values ($1,...)
on conflict (dni) do update set   -- requiere índice único en dni (agregar si no existe)
  -- merge: pisar solo nulos / acumular low_confidence; o no-pisar si ya está cargado a mano
  updated_at = now();
```
*(Decisión menor al construir: `on conflict (dni)` necesita un índice único en `dni`. Si no querés
unique global en dni —puede haber DNIs en otros sources— usamos `where not exists` por dni+source.)*

## Pendiente para cablear
- Trigger Google Drive (carpeta Solicitudes RDLS) → descarga PDF → base64 → Gemini.
- Credencial Google Drive en n8n (en proceso).
- Test con 1 PDF antes de activar.

---

## Hallazgo de campo (2026-06-13) — fortalezas y límites del OCR de visión
> Validado contra ~78 forms reales + control humano ficha por ficha. **Engine actual: Claude**
> (`claude-opus-4-8`, bloque `document`/PDF + `tool_choice` forzado sobre `extract_forms`).
> Se reemplazó Gemini → Claude: salto enorme en checkboxes (Gemini erraba ~10 de 12; Claude ~0).
> Builder: `XIMIA/scripts/ocr_ingest_build.py`. Este doc describe la versión Gemini original.

**El patrón de errores (la regla operativa):**
- **FUERTE en texto** — nombres largos, apellidos raros, palabras, casillas. La redundancia
  lingüística autocorrige caligrafía malísima (ej. "Porcheddu" sale perfecto aunque ilegible).
- **DÉBIL en números aislados** — DNI, CUIL, montos, fechas. Cada dígito es independiente, sin
  contexto que lo corrija. Ahí viven casi todos los errores residuales.
- **Asterisco**: texto **corto + vocales ambiguas** también es zona de riesgo (ej. "Darío"↔"Dorio"
  — irresoluble incluso mirando la ficha original).

**Piso irreducible:** algunos campos son ambiguos **hasta para un humano** con la ficha en la mano.
No forzar una lectura "correcta" → **flaggear** (`low_confidence_fields`) y **confirmar en el primer
contacto**. Es un lead: vas a hablar por WhatsApp igual, ahí se confirma el nombre/DNI dudoso. **La
ficha es el ARRANQUE de una conversación, no el registro final.**

**Redundancia de número = el ancla:** el DNI se escribe dos veces (campo DNI + medio del CUIL
`XX-DNI-Y`). Si coinciden entre sí → lectura sólida. Si no → grito de "revisá este número". Por eso
el check **dni↔cuil va en CÓDIGO determinístico** (nodo *Validate + map*), no como auto-flag del
modelo (GOLDEN RULE). *Bug histórico (arreglado 2026-06-13): el slice estaba corrido —`slice(1,…)`
en vez de `slice(2,10)`— y disparaba `dni_cuil_mismatch` en TODOS, incluso los que coincidían.*

**Diseño del control humano (lo que hace esto escalable):** el reviewer **no relee todo** — mira
solo los **campos marcados** (casi siempre números) contra la foto. Convierte "transcribir 26
campos" en "verificar 2-3". Eso permite que una persona junior absorba 50-70 forms/día.

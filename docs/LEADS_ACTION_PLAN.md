# Plan de acción de leads — engagement, automatización, HubSpot & Drive

> Estado: **borrador de plan (2026-06-19)**. Captura las decisiones de la sesión de hoy.
> Varias piezas son mini-proyectos propios; acá queda la estrategia + las decisiones abiertas.
> Regla viva: **PII (Ley 25.326) NUNCA al repo** — este doc solo lleva agregados, nunca datos personales.

## 1) Inventario actual (snapshot 2026-06-17, export HubSpot, 81 leads)
Todos UOCRA / Neuquén. Bucket derivado de (tiene_lote × crédito_hoy):

| Bucket | # | % | Acción |
|---|---|---|---|
| **QUALIFIES_LATER** (crédito ok, sin lote) | 62 | 76% | lista de prioridad + re-enganche cuando entre loteo |
| **READY** (crédito + lote) | 13 | 16% | cerrar — la plata más cercana |
| **READY_BLOCKED** (sin crédito hoy) | 6 | 7% | el puente (codeudor / ahorro) |

Blockers: 55 `tierra`, 8 `dato` (falta info), 7 `consentimiento` (falta consent), 7 `ninguno`.
**Crítico:** los **7 sin consentimiento NO se contactan comercialmente** hasta tenerlo (Ley 25.326) →
flujo "confirmá tus datos" primero. Los `dato` faltante: completar antes del comercial.

Los 62 QUALIFIES_LATER = la palanca "demanda lista, sin tierra" para negociar lotes (UOCRA/Provincia/privados).

## 2) Arquitectura: EVENT-DRIVEN (no polling)
**Aprendizaje caro:** el sync `CF Leads → HubSpot` (n8n `NeCgwr0mM6wCI0W8`) corría **cada 1 min**
(1.440 ejec/día) → **consumió el límite de n8n en un día** → se apagó. **No reactivar así.**

**Diseño correcto — un flujo por evento, al subir el lead:**
```
lead creado/actualizado  (OCR batch  |  conversión del chat)
        │
        ├─► upsert a HubSpot (Contact + props CF + carpeta Drive)
        └─► dispara el ENGAGEMENT del bucket (WhatsApp + Mail) + registra el touch en HubSpot
```
Corre **O(leads)**, no O(minutos). Cero ejecuciones ociosas.
**Restricción de diseño global:** el límite de ejecuciones de n8n aplica a TODO el frente de
automatización (sync + WhatsApp + Mail). Todo por evento o por lote programado, nunca poll de alta
frecuencia. Considerar sacar la automatización pesada FUERA de n8n (script/cron propio o Server Action
del catálogo) y dejar n8n para lo conversacional. → **DECISIÓN ABIERTA: plan/límite de n8n.**

## 3) Plan de comunicación por bucket (engagement + re-engagement)
Canal: **WhatsApp + Mail → todo registrado en HubSpot** (system of record del seguimiento).

- **READY (13):** cerrar. "Tenés crédito Y tierra — avancemos." Touch inmediato + 2 follow-ups.
- **QUALIFIES_LATER (62):** postura #17 (ya blindada en el agente). "Tu crédito está; te avisamos
  apenas entren lotes en Neuquén." Touch inicial + re-enganche por `re_engagement_trigger` (cuando
  aterriza loteo). NUNCA prometer conseguir/financiar el lote (garantía no-loteo ya en el agente).
- **READY_BLOCKED (6):** el puente — codeudor / plan de ahorro, honesto, puerta abierta.
- **Data-quality (8 dato + 7 consent):** completar/consent ANTES del comercial.

→ **DECISIÓN ABIERTA: WhatsApp ¿API (Cloud/Twilio/360dialog) o celular?** Sin API el WhatsApp no se
automatiza de verdad (queda semi-manual con links `wa.me` pre-cargados). Define todo el frente.
→ **Contenido de los templates: requiere aprobación de Andrea antes de enviar a gente real** (outbound
irreversible).

## 4) HubSpot "que se sienta propio" — dirección: HÍBRIDO (no reemplazar)
HubSpot = **CRM + motor de automatización** (ya integrado: Private App token, Properties API
`scripts/hubspot_props.py`, sync workflow, props CF). No tirarlo.
Lo genérico se mitiga (grupos de props "Perfil Ximia / Calificación / Estado", record page custom,
pipeline con etapas = buckets, vistas por rol) — pero hasta cierto punto.

**El diferenciador real (y argumento de venta de Ximia):** una **"Ximia Lead Dossier"** propia —
vista branded (en el Next.js del catálogo o página interna liviana) que lee `leads` + `intelligence_json`
(dossier, drivers, objeciones, verbatims, pitch_angle). Esa es la superficie demo-able que impresiona al
próximo cliente. HubSpot queda de cañería; la vista-estrella es nuestra.
→ **DECISIÓN ABIERTA: confirmar el híbrido.** Si sí, la Lead Dossier es un mini-proyecto.

## 5) Drive de documentos (por lead)
- **Carpeta por lead** en Google Drive (key = DNI o lead id): formulario firmado, DNI, comprobantes,
  escrituras.
- Link de la carpeta como property en HubSpot ("Carpeta Drive") + en `leads`.
- El pipeline OCR (#25) además **dropea la foto fuente** en la carpeta del lead → un solo flujo:
  foto → OCR → lead + archivo en Drive.

## 6) Los 3 lotes nuevos (fotos)
Reusan el pipeline OCR #25 (foto → Gemini → validación CUIL↔DNI → insert `leads` con bucket) → entran
al flujo event-driven (§2) y caen en su bucket (§3).

## Decisiones (resueltas 2026-06-19)
1. **WhatsApp = API** ✅ → la automatización es viable (confirmar proveedor: Cloud API / Twilio / 360dialog).
2. **Híbrido confirmado ✅ — y reframe estratégico:** el **Ximia Lead Dossier es client-custom / multi-tenant**.
   Cada cliente (posiblemente con costo) puede tener su Dossier con SU marca, reglas y vistas. Deja de ser
   "vista interna" → es **feature-producto que diferencia a Ximia y se cobra**. Pensarlo así desde el diseño
   (theming + reglas/vistas por tenant). Encaja con la visión multi-vertical de Ximia.
3. **n8n: Starter 2.500 ejec/mes hoy**, upgradeable; **objetivo etapa 1 = Pro 10k**. Diseñar económico ahora
   (event-driven, batches), con holgura a 10k. Sacar lo pesado fuera de n8n si conviene.
4. **Consent:** Andrea los está consiguiendo. Regla operativa: si un lead está **listo y solo falta consent**
   → avisarle a Andrea (ella lo consigue). Si está **bloqueado por terreno (QUALIFIES_LATER)** → integrarlo
   igual; el form actualizado llega en breve.

## PROGRESO (2026-06-19)
- ✅ **Paso 0 — HubSpot 100% inglés** (DONE, verificado). `scripts/hubspot_props_en.py` (--create/--migrate/--archive).
  21 props EN creadas, 77 contactos migrados con fidelidad, 21 props ES archivadas (restaurables 90d).
  `marital_status` resultó nativa de HubSpot. `dni` (unique key) intacto. `blocker_code` relabeleado EN.

## Build-ready design (BLOQUE DE EJECUCIÓN)

### Corrección de arquitectura (importante)
El `UOCRA OCR Ingest` **solo inserta datos CRUDOS** (name/dni/income/has_lot/consent…). La calificación
(`bucket`/`loan_usd`/`blocker`) es un paso **separado** (`scripts/qualify_leads.sql`, UPDATE set-based
idempotente). → El upsert enriquecido NO puede ir justo tras el insert; va **después de qualify**.

### Pipeline corregido (un solo evento, end-to-end)
```
OCR Ingest:  Run → List PDFs → Split → Loop[Download→Claude→Validate→Insert RAW]
                                          └─(done)→ QUALIFY (UPDATE de qualify_leads.sql)
                                                  → Select leads pend. sync (synced_hubspot_at IS NULL & qualifies not null)
                                                  → HubSpot Upsert ENRIQUECIDO (props EN)
                                                  → Mark synced
                                                  → [hook: ENGAGEMENT por bucket]
Sync standalone (NeCgwr0mM6wCI0W8) = BACKSTOP (chat + stragglers), cron baja frecuencia (~6h).
```
`qualify_leads.sql` corre el UPDATE sobre todos (idempotente) — incluye los nuevos del lote. Barato.

### Mapeo enriquecido: leads (Supabase) → HubSpot (props EN)
| leads | HubSpot EN | nota |
|---|---|---|
| name | firstname / lastname | split en 1er espacio |
| phone / email | phone / email | |
| dni | **dni** | **unique key del upsert** |
| cuil | cuil | |
| has_lot (bool) | has_lot (enum) | true→'Si', false→'No' |
| bucket | bucket | enum (incluye READY_BLOCKED nuevo) |
| blocker (prosa) | blocker_prose | |
| (derivar) | blocker_code | derivar: sin lote→'tierra'; sin consent→'consentimiento'; sin crédito→'ingreso'; sin dato→'dato'; else 'ninguno' |
| loan_usd / adus_loan_with_lot_usd | credit_now_usd / credit_with_lot_usd | |
| monthly_income_ars / savings_amount | income_ars / savings_ars | |
| residency_years / first_home | residency_years / first_home | |
| province / campaign_slug | province / campaign | |
| consent_captured_at | consent_status | 'captured'/'pending' |
| re_engagement_trigger / next_action | next_step | |
| lead_score / priority | lead_score / priority | |

**Decisión de dedup (resolver en el bloque):** el nodo HubSpot de n8n hace upsert **por email**; nuestra
llave real es **dni** (muchos UOCRA sin email). Opciones: (a) **HTTP Request a HubSpot v3 con
`idProperty=dni`** (dedup limpio por dni + control total de props EN) — recomendado; requiere el Private
App token como credencial n8n (Header Auth) → Andrea la crea en la UI. (b) nodo HubSpot + email fallback
`{dni}@no-email.cf` (dedup por email derivado de dni) — usa la cred OAuth2 ya existente, menos limpio.

### Engagement por bucket — DRAFTS (requieren aprobación de Andrea antes de enviar a gente real)
- **READY (13):** "Hola {nombre} 🏡 Tenemos excelentes noticias: calificás para tu crédito hipotecario, y como ya tenés el terreno estás a un paso de hacer realidad el proyecto de tu nueva casa! ¿Coordinamos una llamada de 15 min para armar tu plan?"
- **QUALIFIES_LATER (62):** "Hola {nombre} 🏡 Excelentes noticias: calificás para un crédito que te permite construir la nueva casa que soñás (estimado
  USD {credit}). Lo único que falta para hacerlo realidad es conseguir el terreno que necesitás. Estás de acuerdo en que te anotemos en la **lista de prioridad de {Localidad}, {Provincia}**? Si nos das el ok, apenas se abra un loteo serás de los primeros en enterarse. Te tenemos al tanto! 💪"
- **READY_BLOCKED (6):** "Hola {nombre} 🏡 Estamos viendo tu caso y para encontrar el mejor camino a tu
  casa soñada (un codeudor o un plan de ahorro pueden destrabarlo). En breve te contactamos con opciones."
- **DATA/CONSENT (15):** "Hola {nombre} 🏡 Para avanzar con tu solicitud necesitamos confirmar {dato}.
  ¿Nos lo confirmás?" (los 7 sin consent: flujo de captura de consentimiento PRIMERO — Ley 25.326).

Canal: WhatsApp **API** (confirmar proveedor: Cloud/Twilio/360dialog) + Mail. Cada touch → registrado en
HubSpot (timeline). Disparo por evento (al subir/calificar el lead) + re-enganche por `re_engagement_trigger`.

### Orden del bloque de ejecución
1. **Integrar QUALIFY al OCR Ingest** (nodo SQL del UPDATE tras el loop).
2. **Upsert enriquecido** (HTTP v3 idProperty=dni, props EN) + Mark synced. **Test con 1 lead** → verificar en HubSpot. **No bulk sin OK.**
3. **Sync standalone → backstop** (trigger event/cron 6h, mapeo EN igual).
4. **Engagement por bucket** (tras aprobar contenido + resolver WhatsApp API).
5. **Drive por lead** + property "Carpeta Drive".
6. **Ximia Lead Dossier** (client-custom / multi-tenant — el mini-proyecto de marca).

### Pendientes para Andrea (destraban el bloque)
- **WhatsApp:** ¿proveedor de API? (Cloud API / Twilio / 360dialog)
- **Token HubSpot como credencial n8n** (para el upsert HTTP v3) — o vamos con la opción (b) OAuth2.
- **Aprobar el contenido de los 4 templates** antes de enviar a gente real.

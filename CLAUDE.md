@AGENTS.md

# ConstruirFácil — KB del desarrollador (datos + dominio)

> **Propósito:** memoria del PROYECTO, no de una sesión. Cualquier IA que trabaje acá lo lee primero.
> Si descubrís un hecho durable, escribilo ACÁ, no solo en la memoria personal de un asistente.

## Qué es esto
**ConstruirFácil** (web Next.js) = catálogo/marketplace de constructoras de casas modulares. Marca
inicial con catálogo cargado: **Hausind**. Brand padre = ConstruirFácil; marcas viven en `public.marcas`
(renombrada de `constructoras` en migración 0003).

## DB compartida con Ximia (CRÍTICO)
La web **ConstruirFácil** y el **agente Ximia** (n8n, `~/Projects/XIMIA`) **comparten UNA sola base
Supabase** (`gvuzjbbgxefbtiuyxaoy.supabase.co`), acopladas por foreign keys.
- **Runtimes separados, esquema unificado.**
- **`supabase/migrations/` es el ÚNICO source of truth del esquema.** Todo cambio = migración numerada
  `NNNN_nombre.sql`, secuencial. **El founder corre el SQL a mano** en el SQL editor de Supabase.
- **Ximia/n8n NO hace DDL** — solo lee/escribe filas.
- Ver `XIMIA/CLAUDE.md` para el lado del agente.

## Identidad cruzada catálogo ↔ Ximia (login/cookies/sesión)
El visitante se reconoce **en las dos direcciones** entre la web y el agente. No hay SSO externo: el
puente es la **tabla `public.users` compartida** + **cookies firmadas** que ambos runtimes leen.
- **Fuente de verdad de identidad = `public.users`** (la misma Supabase). Todo lo demás son *pivotes*
  (`user_id`, `email`) que resuelven a esa fila.
- **3 fuentes del lado catálogo** (prioridad): (1) **OTP/OAuth** → cookie **`cf_client`** (`source='verified'`,
  alto); (2) **lead form enviado** → cookie **`cf_session`** (`source='lead'`, medio); (3) **cuenta Supabase**
  (`auth.users.id`, `source='supabase'`). Lector SSR: `lib/auth/get-current-client.ts` (`currentClient()`).
- **Cookies firmadas (anti-tamper):** HMAC-SHA256, payload `email|firma`, **domain-tag** (`gate:` vs
  `session:`) para que no se pueda forjar un `cf_client` desde el form de lead. `lib/auth/gate-cookie.ts`
  + `session-cookie.ts`. HTTP-only, `cf_client` maxAge 60 días. ⚠️ Secret hoy cae a
  `SUPABASE_SERVICE_ROLE_KEY` → **para prod definir `CF_GATE_SECRET` aparte** (lo pide el propio código).
- **El puente = `GET /api/ximia/identity`** (`app/api/ximia/identity/route.ts`): combina cookie + sesión
  Supabase y devuelve `{ user_id, email, source }`. **No enriquece name/phone** — eso lo hace n8n.
- **El widget** (`components/ximia/XimiaWidget.tsx`) hace `fetch('/api/ximia/identity')` al montar y postea
  a n8n con body PLANO `{ chatInput, sessionId, user_id, email, name, phone }`.
- **n8n hace el JOIN**: `select name, phone, email from public.users where id = $user_id::uuid or email = $email`
  → Ximia reconoce al visitante del catálogo. **Vuelta:** si Ximia verifica por OTP dentro del widget, setea
  `cf_client` y refresca identidad → la próxima carga del catálogo ya lo reconoce por la misma cookie.
- **Endpoints de estado que gatean UI del catálogo:** `/api/client-status` (¿identificado? + `source`),
  `/api/lead-session` (¿ya dejó lead? → success state en `LeadForm`/`ReservarModal`).
- ⚠️ Lado n8n: **`DEV_BYPASS_AUTH=true`** (`XIMIA/Decision_Engine.js` ~L18) saltea email/OTP — **prendido
  para test, APAGAR para prod**. Ver `XIMIA/CLAUDE.md` (gotchas) + nodos `Auth_Code_Generator.js`,
  `Google_sessionId.js` para el flujo OTP/OAuth del lado agente.

## Estado del esquema (relevamiento 2026-05-31)
40 tablas públicas. 28 (catálogo/contenido/marketing) versionadas (migraciones 0001–0049). **12 tablas
del lado Ximia se habían creado ad-hoc fuera del repo** → recapturadas en
**`0050_baseline_ximia_tables.sql`** (`create table if not exists`, no-op contra la DB viva):
`users, projects, system_config, banks_financing, construction_quotas, financial_matrix,
private_financing_commitments, lots_inventory, conversations, messages, lead_qualification,
property_matches`. ⚠️ Estas 12 NO tienen RLS ni triggers hoy — pendiente review de seguridad.

## Capa geo / cupo — `0051_geo_layer_cupo_catalogo.sql` (aplicada + commiteada)
La **ubicación manda**: disponibilidad, cupo, financiación y precio dependen de la provincia.
- `construction_quotas`: +`marca_id`, +`provincia_id`, +`margin_pool_usd`, +`close_month`,
  `project_id` nullable, índice único de cohorte. **Cupo = por (marca × provincia). CUPO 0 = sin
  programa.** Seed: **Hausind × {neuquen, misiones} = 25/25** (pool 0, open, start 2026-06-01).
- `banks_financing` (7 líneas): +`provincia_id`, +`min_residency_years`, +`max_household_income_ars`,
  +`rci`. **Línea IPVU Neuquén:** residencia **5+ años**, ingreso familiar **< 6.5MM ARS**, rci 0.30,
  geo-gated. (rci: Hipotecario UVA & Personal Construcción 0.25; Nación 1ra/2da & Neuquén Única 1/2 0.30.)
- **Precios:** 3 por modelo → pozo < cupo/contado/base < lista. "Contado" = precio CUPO = base.
  Precio base nacional + ajustes zonales por marca en **`marca_zonas`** (migración 0047:
  `price_modifier_pct`, `extra_charge_amount`, `excluded` bool). **Disponibilidad = modelo de EXCLUSIÓN
  por marca** (default: todas las provincias). `provincias`/`marca_zonas`/`lineas` en 0002/0047.

## Hechos de dominio
- **Hausind tiene 3 líneas:** BOSQUE (premium), ATLAS (estándar), TERRA (la más chica/económica,
  open-concept). La planilla `INFO/Hausind Catalog Prices 220526.xlsx` solo tenía BOSQUE+ATLAS.
- Catálogo de casas vive en `house_catalog` (renombrada de la tabla de modelos previa).
- **3 tiers de precio por tiempo de entrega:** `precio_pozo` < `precio_contado` (**= Precio CUPO = Costo
  Neto**) < `precio_lista`. El comprador de cupo paga Contado/Cupo (pozo = espera más, más barato).
- **`costo_no_financiable_usd` = `0,75 × costo_neto`** (= 0,75 × precio_contado). Es el piso de obra que
  Hausind debe recuperar; el margen financiable por el pool = `precio_tier − costo_no_financiable`.
  (En paquetes con lote, incluye el lote en ambos lados.) Agregado en migración `0070`.
- **⭐ Actualización de precios = `scripts/update_prices.py`** (proceso OFICIAL, repetible). Lee la
  planilla (hoja "SUPERFICIES COSTOS OK") + un export CSV vivo de `house_catalog`, matchea por CLAVE
  ESTABLE (linea+tipologia+variante+style+sistema — NO por SKU, que codifica el área CONGELADA), y emite
  una migración `fix_prices` de puros UPDATE (sin delete/insert, SKU intacto) + guard del no_financiable
  + reporte de cobertura. NO actualizar precios a mano ni en el admin. Ver docstring del script.
- Condiciones financieras de origen: `INFO/Financiación_Bancaria.xlsx`.
- **⭐ Taxonomía canónica de leads (multi-canal): `docs/leads_taxonomy.md`.** Modelo reutilizable para
  TODOS los sources (UOCRA/web/futuros). Principio: HECHOS atómicos vs VEREDICTO derivado. Regla de
  dominio: `horizonte_compra` (3m/6m/12m) es driver de tier de precio (lista/cupo/pozo). Score = FIT×INTENT.
  Campos: migración `0083`.

## Motor de financiación — `evaluate_property_options` (⚠️ UNA sola función)
Firma canónica: **10 args** (`…, p_has_lot, p_income_currency`). Históricamente se acumularon overloads
(7/8/9/10 args) porque `create or replace` NO reemplaza si cambia la aridad → **consolidado a UNO en
`0095`** (dropea 7/8/9, deja el de 10). **No recrear overloads:** cualquier cambio de firma debe DROPear
las viejas explícitamente. Consumidores: `qualify_leads` (10 args), `send_engagement`/`reconcile` vía
PostgREST RPC (9 params → `income_currency` default), n8n.
- **Bug fixeado en `0095`:** `monthly_payment_ars` se devolvía como `income×rci` (techo de capacidad) aun
  cuando el loan quedaba TOPEADO (150M ADUS / tope UVA) → cuota inflada para leads de ingreso alto. Ahora se
  re-deriva del loan final (amortización). Los afford-limitados no cambian.
- **Limitaciones conocidas (follow-up, no bug):** `total_budget = loan + ahorro` ignora `max_financing_pct`
  → sobreestima presupuesto para las 3 líneas <100% (Nación 1ra/2da 90%, Hipotecario UVA 80%); el ingreso
  individual se trata como familiar.

## Engagement mail a leads — `scripts/send_engagement.py` (mailer OFICIAL)
Primer touch comercial a leads UOCRA consentidos, por **Resend** (NO n8n, NO Gmail). Lo dispara el asistente.
Segmentado por bucket (READY / QUALIFIES_LATER), idempotente (`engagement_sent_at`), respeta `unsubscribed`
+ consentimiento (Ley 25.326).
- **Bloque crédito + casas por lead:** lee del motor en vivo (`evaluate_property_options` + `province_catalog`)
  → monto/plazo/cuota/línea + 2 casas que entran en el presupuesto (tope 90m² si ADUS). Si el crédito no llega
  a la casa más barata, muestra crédito + link al marketplace, sin casas (no miente).
- **Creds:** `.env.local` → `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (`ConstruirFácil <hola@construirfacil.com>`,
  dominio verificado). ⚠️ Cloudflare bloquea el UA de urllib → mandar `User-Agent` normal (si no, 403/1010).
- **Log en HubSpot:** en `--commit` va BCC a la dirección CCO del CRM (`51568289@bcc.hubspot.com`) → el mail
  queda en el timeline del contacto. **Solo en envíos reales**, nunca en `--test` (crearía contactos basura).
- Uso: `--test <email>` (dry, sin BCC) · `--test <email> --with-bcc` (probar el log) · `--commit` (real).
- Envío masivo real = op con OK de Andrea + Guillermo.

## Engagement automático CF → n8n (eventos + router) — ⭐ ancla: `docs/engagement/DESIGN.md`
El **corazón de la atención al cliente CF + Ximia**. CF **emite eventos crudos**; n8n **rutea y actúa**
(GOLDEN RULE: la lógica de ruteo vive en el workflow determinístico, NO en el prompt del agente).
- **Productor:** `lib/engagement/emit-event.ts` — best-effort, `await` con timeout 3s (AbortController),
  nunca rompe el flujo. Enganches: `verifyOTP` → `otp_verified` (Seg A) · `submitLead` → `lead_created`
  (Seg B/C/D). Si `N8N_ENGAGEMENT_WEBHOOK_URL` está vacía → no-op + warning (dev anda sin n8n).
- **Consumidor:** workflow n8n **`CF Engagement Router`** (id `6OkOnL6ROx9n2kH2`, **Active**), webhook
  `POST /webhook/cf-engagement`. Rutea por `event` + `marcas.plan` (nodo "Get marca.plan" = Supabase API
  server-side, service_role). Los 4 nodos "Seg …" siguen siendo **NoOp placeholders**.
- **Segmentos:** A = curioso que verificó OTP (aún sin lead) · B = "quiero esta casa" marca `plan=cf_ximia`
  (precalifica Ximia) · C = "quiero esta casa" marca `plan=cf` (bienvenida marketplace + SLA 48h/QA) ·
  D = lead sin `marca_id` (marketplace sin marca).
- **Modelo de datos (mig. 0097):** `marcas.plan` enum `('cf','cf_ximia')` + `marcas.price_visibility`
  enum `('public','gated','hidden')`. Hausind = `cf_ximia` + `gated`. `price_visibility` supersede a
  `show_prices` (migración del código que lo lee, pendiente).
- **Env:** `N8N_ENGAGEMENT_WEBHOOK_URL` = `https://construirfacil.app.n8n.cloud/webhook/cf-engagement`
  (+ opcional `N8N_ENGAGEMENT_SECRET`). ✅ en `.env.local` Y en Vercel (Production, con redeploy).
- **Path REAL del Seg D:** el CTA **"Quiero que me contacten"** del promo banner → abre `ReservarModal`
  **genérico** (sin `marca_id`). NO es `/cotizar` (ruta huérfana: sólo `CotizadorUber` la enlaza y no
  está montado en ninguna página → los null-marca ahí suelen ser bots/spam).
- **`lead_verified` → push a HubSpot (2026-07-18).** El magic link del mail (`/verify?u=<HMAC>`,
  `app/verify/route.ts`) **NO pasa por el OTP del catálogo** → el Seg A nunca se disparaba para los
  del sindicato. `verifyLead()` emite `lead_verified` **dentro del `if (!lead.email_verified_at)`**
  (idempotente: re-clickear no re-dispara n8n). Rama en el router: `Route: lead_verified?` →
  `HS: buscar por lead_id` → `¿Está en HubSpot?` → `HS: marcar verificado` (`estado_registro` +
  `email_verified_at`). Probado end-to-end (ejec. #6823).
  - **Matchear por `lead_id`, NUNCA por email** — los mails se tipean mal y se corrigen (caso Matto:
    HubSpot `mattogrise@` vs Supabase `mattogrisel@`). `lead_id` está cargado 40/40 en HubSpot.
  - ⚠️ **Nodos NATIVOS de HubSpot, no HTTP Request**: n8n prohíbe la credencial `hubspotOAuth2Api`
    dentro de HTTP Request ("configured to prevent use…") y **no hay toggle que lo destrabe**.
  - ⚠️ El nodo nativo usa la **API v1** → las props `date` quieren **epoch ms**, no `YYYY-MM-DD`
    (`new Date(x.slice(0,10)).getTime()`). Con string da `Bad request - please check your parameters`.
- **Propiedad `estado_registro`** («🚦 Estado del registro»: `verificado` / `mail_enviado` /
  `sin_contacto`) — la columna que escanean las asesoras. `email_verified_at` («✉️ Registro
  verificado») queda como el **cuándo**, fuera de las columnas de la vista para que nadie la cargue
  a mano. Backfill 2026-07-18: 40 contactos (6 + 34).
- 🚨 **REGLA DURA — n8n se paga por ejecución: NUNCA un `scheduleTrigger` de minutos.** El workflow
  **`CF Leads → HubSpot Sync`** (id `NeCgwr0mM6wCI0W8`, **OFF y así se queda**) corría **cada 1 min**
  = 1.440 ejec/día y **se comió todo el crédito de n8n**. Todo lo que dispare n8n va por **webhook**
  (evento real: ~unidades por día) o, si no hay más remedio, un schedule **diario**. Ante la duda:
  el productor (CF) emite el evento; n8n no encuesta.
- 🚨🚨 **ABIERTO — AUDITORÍA DE CALIFICACIÓN. ⭐ ancla: `docs/AUDITORIA_CALIFICACION_2026-07-18.md`**
  **NO calificar los ~281 leads restantes ni correr `qualify_leads.sql` hasta resolverla.** Resumen:
  (a) bug `first_home` arreglado sin ejecutar → 7 leads sobrecotizados 40-50%; (b) 🔴 **la tasa ADUS
  está en 2% pero el propio `requirements_text` dice "6% por defecto"** → TODAS las cotizaciones ADUS
  podrían estar 29% altas — decisión pendiente de Andrea; (c) el script ignora `partner_income_ars`
  (el tool de n8n sí lo suma) → 3 leads con ADUS pese a superar el tope familiar de 6,5M;
  (d) `has_escritura` no se filtra pese a ser requisito ADUS (24/40 sin escritura); (e) edad 18-65
  no existe como condición. **El agente Ximia está BIEN** — el bug es solo del script batch, que es
  una segunda implementación del mismo criterio. Falta un test de conformidad por línea de crédito.
- 🚨 **ABIERTO / URGENTE — Bug `first_home` → ADUS mal otorgado (2026-07-18).** El ADUS de Neuquén
  Habita es `vivienda_unica` ("dirigido a quienes NO posean vivienda previa"). `qualify_leads.sql`
  tenía **`'primera_vivienda'` hardcodeado** (líneas 24 y 35) y **nunca leía `leads.first_home`** →
  el motor daba ADUS (2%, 20a) a gente que declaró NO ser primera vivienda, en vez de Banco Nación
  Segunda Vivienda (12%, 30a). **Script ARREGLADO, NO CORRIDO.**
  - **7 leads de la tanda UOCRA cotizados 40-50% de más, y ya recibieron el mail con la cifra alta:**
    Ariel Gomez (49.669→24.144, ✅verificó) · Margarita Matto (121.504→70.821, ✅verificó) ·
    Anahí Viedma (99.338→48.287) · Marcelo Mulbayer (99.338→51.506) · Natalia Gutiérrez
    (78.546→32.192) · Graciela Serna (74.619→30.582) · Wanda Zumelzu (99.338→45.068, `first_home`
    SIN DATO). Dispersos en 6 listados ⇒ es transversal, no un PDF mal leído.
  - **Orden decidido por Andrea: preguntar ANTES de recalcular** — la vivienda previa puede no estar
    a nombre de la persona, en cuyo caso sí califica y no hay nada que corregir. Recalcular primero
    obligaría a una segunda corrección hacia arriba que ya nadie creería.
  - **Contaminación colateral:** 13 leads con `qualifies_adus_with_lot=true` y `first_home=false`.
    El RADAR de negociación de tierra queda inflado ~2% (USD 537k sobre 22,1M) — el argumento de
    "244 con demanda lista" se sostiene, pero el número no es exacto.
  - **Lección de fondo:** el dato estaba (ficha → OCR → `leads.first_home`), la regla estaba
    (`banks_financing.destination='vivienda_unica'`). Se perdió **en el cable entre los dos**, y
    apareció por casualidad al ordenar por crédito y ver 2 filas fuera de la curva. **No existe
    ningún chequeo que valide el resultado del motor contra las condiciones del producto** — eso es
    lo que falta para que no dependa de que alguien mire bien.
- ⭐ **Decisiones cerradas: `docs/DECISIONES.md` + candado en `scripts/test_conformidad.sql`.**
  Registro append-only (D-001…D-009) con el *por qué* de cada decisión de negocio y el lugar exacto
  donde vive. **Antes de escribir una migración que CAMBIE un valor existente, buscá ahí.** El candado
  real no es el archivo: es el test, que afirma esos valores contra la DB viva y explota con el número
  de decisión violado. Nació porque la `0076` revirtió en silencio la tasa ADUS que la `0058` había
  fijado en un COMENTARIO → 40 créditos cotizados 29% de más. **Un comentario en prosa no es una
  garantía.** Una entrada en DECISIONES sin assert en el test es una decisión sin candado.
- 🗂️ **Legajo Nro. (D-009) — CONGELADO. ⭐ ancla: `docs/uocra/HANDOFF_2026-07-21.md`.**
  `Letra + 5 dígitos`: `A` lote+anticipo · `B` lote sin anticipo · `C` sin lote con anticipo · `D`
  ninguno; correlativo **global** desde `00050`. **299 emitidos** (`D00050`…`A00349`); `230` y `231`
  quemados por duplicado — un número quemado no se reasigna nunca.
  - **Se emite SOLO con `emitir_legajos()`** (migración `0101`, idempotente). A mano nunca: un legajo
    cargado en una planilla o en HubSpot se desincroniza. Formato forzado por CHECK, unicidad por índice.
  - **Inmutable de verdad:** `trg_legajo_inmutable` rechaza cualquier UPDATE de un legajo emitido. La
    letra dice **cómo entró** la persona, no cómo está hoy (eso se lee de `has_lot`/`has_anticipo`).
    Consecuencia: **no se puede retirar un legajo** — para anular uno hay que borrar la fila entera.
  - **Sin `has_lot` o sin `has_anticipo` NO se emite.** La letra no se inventa. 67 leads sin legajo hoy:
    21 del sindicato (falta solo el anticipo → 20 tareas creadas) y 46 de web_form (**el formulario del
    catálogo no pregunta ni lote ni anticipo** — hueco estructural).
  - ⚠️ **`has_anticipo` NO se deriva de `savings_amount`**: 7 personas declaran anticipo con el monto
    vacío. Propiedad `¿Tiene anticipo?` creada en HubSpot el 21-jul (no existía dónde cargar la
    respuesta); `savings_ars` renombrada a «💰 Monto del anticipo (ARS)». Propiedad `🗂️ Legajo Nro.` en
    HubSpot es de **lectura**: la emite Supabase (`push_legajo_to_hubspot.py`), el sync de vuelta nunca
    la lista.
- 🚨 **ABIERTO — DUPLICADOS en `leads`: la dedup vive en el código, no en la base.**
  `app/cotizar/actions.ts` chequea "¿ya existe este email?" antes de insertar; **la ingesta OCR (n8n)
  entra por otro camino y no chequea nada** → el 1-jul insertó encima de filas de web_form de junio,
  incluso con el email idéntico. Tampoco protege a la web contra sí misma (dos envíos con 2 minutos de
  diferencia crearon dos filas: sin índice único, el chequeo en código pierde la carrera).
  - **`resolve_user` (0093) está bien hecho pero opera sobre `users`, no sobre `leads`** — y `leads` es
    la tabla que alimenta legajos y llamadas. Además es tan bueno como el dato que recibe: Bolañuk tenía
    dos `users` porque el OCR le leyó el DNI con un dígito distinto en cada ficha.
  - **Estado:** 2 duplicados con doble legajo eliminados (Bolañuk, Espina). **Quedan 7 leads de
    `web_form` que son personas ya presentes en la tanda del sindicato** — no tienen legajo, pero
    **siguen entrando a la lista de llamadas**. Listado completo en el handoff del 21-jul.
  - **Falta el candado:** índice único por email normalizado + `duplicado_de uuid` que se llene solo al
    insertar (teléfono+fecha de nacimiento, CUIL, `user_id`) + regla de que un duplicado no recibe
    legajo ni entra a listas. **Es la GOLDEN RULE: la garantía va en la base por la que pasan todos los
    caminos, no en el código de una sola aplicación.**
- 📋 **ABIERTO — Supabase ↔ HubSpot: quién manda cada campo.** HubSpot es la base *viva* (las asesoras
  corrigen datos por teléfono); Supabase es la DB. Hoy solo hay push Supabase→HubSpot, así que **toda
  corrección telefónica se pierde**. Decisión tomada: **NO sync bidireccional** — se reparte la
  propiedad de cada campo y cada uno viaja en una sola dirección. Manda **Supabase**: `email_verified_at`,
  `engagement_sent_at`, `welcome_sent_at`, `unsubscribed`, clics y todo lo derivado del motor (`bucket`,
  `qualifies`, crédito, cuota). Manda **HubSpot**: `email`, `phone`, `assigned_advisor`, `next_step`,
  `has_lot` y el grupo Discovery. Así el loop de eco se previene solo (el push jamás escribe un campo
  de HubSpot). El camino de vuelta va por **webhook de HubSpot → ruta de CF en Vercel**, NO por n8n
  (créditos). Caso jugoso: si la asesora corrige `has_lot`/ingreso hay que **re-correr el motor** y
  devolver el `bucket`. Arrancar chico: `email`, `phone`, `has_lot`. Sesión propia.
  - **✅ IMPLEMENTADO como script manual: `scripts/sync_hubspot_to_supabase.py`** (no webhook todavía).
    Dry-run por defecto, backup antes de escribir, **nunca agendado**. Alcance `sindicato_uocra` +
    `web_form`.
  - ⚠️ **La versión del 20-jul matcheaba SOLO por teléfono** → enlazó 261 de 321 y dejó ~60 leads sin
    corrección ni vínculo, **sin que apareciera en ningún reporte**. Punto ciego invisible. Corregido
    el 21-jul con una **escalera de match** (solo candidato único):
    `synced_hubspot_id` → teléfono → **DNI + ≥1 palabra del nombre** → nombre completo idéntico.
    El nombre en el escalón del DNI **no es adorno**: el DNI de Supabase puede estar desactualizado y
    coincidir con el DNI correcto de otra persona (caso Ramirez/García) → sincronizaría la ficha
    equivocada sin que nadie se entere.
  - **Arbitraje por dígito verificador del CUIL** cuando los dos lados discrepan en identidad: por
    defecto manda HubSpot (acertó 25/25 en la muestra verificada), y solo se frena si el CUIL lo
    **desmiente aritméticamente**. Aplicar D-008 a ciegas en el grupo que nadie tocó a mano pisaría
    datos buenos con rotos. ⚠️ Hay **29 CUIL en HubSpot con verificador inválido** (a confirmar en la
    llamada; NO recalcular el dígito solo: el prefijo 20/23/24/27 depende de la persona).
- **Verificar SIN browser:** API de n8n `GET /api/v1/executions?workflowId=6OkOnL6ROx9n2kH2&includeData=true`
  con header `X-N8N-API-KEY` (key en `~/Projects/XIMIA/.env` → `N8N_API_KEY` + `N8N_BASE_URL`). El `runData`
  dice qué nodo "Seg …" corrió. Para disparar pruebas: POST directo al webhook (payload = contrato de
  `emit-event.ts`). Nota: `n8n` NO guarda ejecuciones si el toggle "Save successful executions" está off.
- **Estado 2026-07-17:** ruteo **A/B/C/D validado end-to-end** (local + sintético) y **producción emite en
  vivo** (ejec. #6818, Seg D desde el sitio real). **SIGUIENTE:** reemplazar los NoOp por los envíos reales
  (mails por segmento — Trello "Engagement · Copy de mails por segmento", necesita copy de Guillermo) y la
  precalificación web del Seg B (cuando Ximia esté live).

## HubSpot — ficha del lead para las gestoras
Las propiedades de calificación se sincronizan desde `XIMIA/scripts/reconcile_hubspot_sync.py` (upsert por
`dni`). Nombres internos en inglés (`bucket`, `credit_now_usd`, `credit_with_lot_usd`, `income_ars`,
`union_section`=seccional, `union_delegate`=delegado, `localidad`, …), agrupadas en HubSpot bajo el grupo
**"🏠 Ficha de créditos"** (labels ES, valores de bucket en criollo). La ficha del contacto se armó con una
tarjeta "Lista de propiedades" ancha en el centro (layout guardado como default del equipo).
- **División de tareas:** primer mail rico (crédito+casas) = nuestro código (HubSpot no puede calcular el
  match de casas); nurture / follow-ups = automatizaciones de HubSpot usando esas propiedades como tokens.
- **Backfill pendiente:** seccional/delegado/localidad en los 292 ya sincronizados (reset `synced_hubspot_at`
  + re-run reconcile; op masivo).
- **✅ Logueo de respuestas entrantes (HECHO 2026-07-15):** las respuestas de leads a `hola@` se registran
  solas en la ficha del contacto. HubSpot NO conecta este buzón por IMAP (Hostinger no es Google/O365) →
  se usó **Conversations Inbox → "Otra cuenta de correo" (team email) por REENVÍO**. En Hostinger hay un
  **reenviador `hola@construirfacil.com` → `hola@construirfcil.hs-inbox.com`** (la dir. que da el asistente
  de HubSpot; "Guardado de copias activado" = `hola@` conserva copia). HubSpot **preserva el `From:`
  original** → asocia al contacto real del lead, no a `hola@`. ⚠️ Si el lead responde desde OTRO mail →
  crea contacto nuevo (fusionar a mano). Probado OK con `ad@andreadowyer.com`.
- **⏳ Responder DESDE HubSpot (pendiente, va con atribución de clics #4):** el canal muestra alerta "sin
  autenticación" porque los servidores de HubSpot no están en el SPF (`include:_spf.mail.hostinger.com`).
  NO afecta recibir. Para responder con la marca sin caer en spam → sumar DKIM/SPF de HubSpot al DNS
  Hostinger. Por ahora se responde desde el webmail de Hostinger. Alerta = informativa, se puede cerrar.

## Mails del catálogo a la marca — `lib/email/lead.ts`
Server-side, vía Resend. Un solo pipe (`sendLeadEmail`) cubre TODOS los forms del catálogo que
notifican a la marca: hoy son **"Quiero esta casa"** y **"Waitlist provincia"** (ambos por el server
action `app/cotizar/actions.ts::submitLead`). Sale también un mail de confirmación al cliente.
- **Destinatario a la marca:** `marcas.lead_notification_email` (editable en `/admin/marcas/[id]`).
- **BCC de tracking al marketplace:** env opcional `LEAD_MARCA_BCC` (ej: `empresas@construirfacil.com`).
  Casilla dedicada, NO conectada a HubSpot — a diferencia de `hola@` no debe reenviar a `hs-inbox.com`
  o va a ensuciar el timeline con salientes. Si la env está vacía → sin copia (sin regresión). Sólo
  BCC-eamos el mail a la marca; el mail al cliente nunca lleva copia.
- **CTAs migrados de mailto → in-app (2026-07-17):** "Cotizar" abre `ReservarModal` in-page (form +
  soft OTP post-success) vía event bus `cf:reservar:open`; "Conversar con Ximia" abre el widget in-page
  vía `cf:ximia:open`. Los helpers viven en `lib/cta/open-reservar.ts` y `lib/cta/open-ximia.ts` — usar
  esos, no volver a `mailto:`. Beneficio: todo el lead pasa por `submitLead` → cae en `leads` con
  atribución y llega al BCC.

## Anti-spam del catálogo — Turnstile + honeypot + rate-limit
Bundle server-side aplicado en `submitLead` (`app/cotizar/actions.ts`). Env-gated: si
`TURNSTILE_SECRET_KEY` no está seteada, es no-op → el deploy puede subir a prod antes que las keys
de CF. Todos los forms públicos que llaman `submitLead` embeben `<AntiSpamFields>` como hijo directo
del `<form>`.
- **Honeypot `hp_website`:** input invisible; si viene con valor, server devuelve éxito fake al bot.
- **Turnstile:** widget VISIBLE (`data-size="flexible"`, no `interaction-only` — con invisible había
  race donde el token no llegaba y devolvía "verificación cargando" antes de que el user supiera qué
  faltaba). El token es single-use → `AntiSpamFields` resetea el widget cuando `state.error` cambia.
- **Rate-limit:** IP 5/h y email 3/día por `checkAndBumpLeadRateLimit` (tabla `form_rate_limits`, fail-open).
- ⭐ **Regla crítica de mount:** cualquier `<dialog>` que contenga `<AntiSpamFields>` (directo, via
  `<LeadForm>` o via `<WaitlistContent>`) DEBE gatear su contenido en `open` (`{open && (...)}`). El
  `<dialog>` no desmonta hijos aunque `dlg.close()`, así que N widgets Turnstile en paralelo cuelgan
  la tab: **"Pages Unresponsive: challenges.cloudflare.com"**. Ya sucedió en `ReservarModal` y en
  `CotizarCenteredModal` (un per ModelRow → 20+ widgets). Al crear un modal nuevo, gatear siempre.

## OTP soft post-lead — `ReservarModal`
Tras submit exitoso, el modal pide OTP para setear `cf_client` (proof alto) — el visitante entra al
próximo catálogo como identificado. Soft = puede cerrar sin verificar; el lead ya se persistió y el mail
a la marca ya salió. Si `useClientIdentified().source === 'verified'` saltea el prompt.
- ⭐ **Regla del `onSuccess` callback:** `LeadForm` tiene dos `useEffect` con `onSuccess` en deps
  (`[state.ok, ..., onSuccess]` y `[existingLeadEmail, onSuccess]`). El handler que pasa
  `ReservarModal` (o cualquier consumer) DEBE ir con `useCallback` de referencia estable — si no,
  cada re-render lo recrea, ambos useEffect re-disparan en cadena y llaman `onSuccess` → si arranca
  `requestOTP`, se generan N códigos en loop (ya sucedió: 20 códigos en 15s). El `handledSuccessRef`
  guard solo no alcanza a cortar la carrera.
- **Rate-limit server-side en `requestOTP`** (`app/(auth)/gate/actions.ts`): si hay un código activo
  (<30s) para ese email, retorna `ok:true` sin insertar/enviar. Defensa en profundidad ante loops
  client-side futuros. `verifyOTP` valida contra el ÚLTIMO row activo — si Resend rate-limita mails
  del loop, el user recibe uno pero DB tiene otro → siempre falla.
- **⚠️ Abierto (2026-07-17):** en una prueba del banner se generaron **3 códigos en 2s** (el guard de <30s
  NO los colapsó → carrera: los 3 requests entran antes de que ninguno commitee) y el modal quedó colgado
  en **"VERIFICANDO…"** sin mostrar el error de código incorrecto. Dos cosas a arreglar en la sesión del
  catálogo: (a) que el guard sea atómico ante requests concurrentes, (b) que el cliente salga del estado
  pending y muestre el error. No afecta al engagement (el emit del Seg A sólo dispara tras verify exitoso).

## Convenciones
- Migraciones: `NNNN_nombre.sql`, secuencial. Nunca renumerar las existentes.
- Next.js: ver el bloque importado de `AGENTS.md` (versión con breaking changes; leer
  `node_modules/next/dist/docs/`).

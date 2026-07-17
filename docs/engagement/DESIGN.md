# Engagement automático CF + Ximia — Diseño

> **Estado:** diseño acordado (2026-07-17, Andrea). Base para construir. Todavía sin implementar
> salvo lo que se marque como HECHO. Cualquier cambio de criterio se edita ACÁ primero.
> Anclado a: `CLAUDE.md` (Mails del catálogo, Identidad cruzada), `docs/leads_taxonomy.md`.

## 1. Por qué

Hoy el workflow de engagement **prácticamente no existe**. El andamiaje de columnas está en `leads`
(`welcome_sent_at`, `re_engagement_trigger`, `engagement_channel`, `notification_status`) pero
está **0% cableado** para los canales web. Este doc define cómo separamos y atendemos, de forma
automática, a los contactos que NO son del pipeline sindicato (que se atiende a mano por las asesoras).

Este es **el corazón de la atención al cliente de CF + Ximia**.

## 2. Estado actual (relevado en código + datos, 2026-07-17)

**Base: 380 leads.** `sindicato_uocra` 321 · `web_form` 52 · `web_chat` 7.
- `web_chat` = pruebas del lab de Ximia → **NUNCA** son leads, no tocar.
- `web_form` = **los 52 son `lead_type='quiero_esta_casa'`** (botón de una casa de marca).

**Flujo "Quiero esta casa"** — `app/cotizar/actions.ts::submitLead`:
1. `resolve_user` (RPC) → fila en `public.users`; dedup del lead por email (enrich vs insert).
2. Dispara 2 mails async (no-await) vía Resend (`lib/email/lead.ts`):
   - a la marca → `marcas.lead_notification_email`, con BCC opcional `LEAD_MARCA_BCC` (=`empresas@construirfacil.com`).
   - de **confirmación al cliente** ("Recibimos tu interés en…"). ⚠️ NO es una bienvenida ni nurture: es un acuse.
3. Setea `notification_status` con el resultado del envío (`pending`→`sent|failed|skipped`).
- **Bug de atribución:** `marca_id`/`model_slug` sólo se guardan si el form viene con contexto de
  catálogo. El form genérico `/cotizar` omite el input oculto (`components/LeadForm.tsx:165`) →
  **45 de 52 leads quedaron con `marca_id` null** (huérfanos). Fix = 1 línea.

**Flujo "Registrarse para ver precios"** — gate **OTP** (`components/auth/CatalogGate.tsx` +
`app/(auth)/gate/actions.ts`):
- Crea fila en `public.users` (`lead_status='warm'`, `email_verified_at`), escribe `email_verifications`,
  setea cookie `cf_client`. **NO crea lead. NO manda bienvenida** (sólo el mail con el código OTP).
- ⇒ El curioso que sólo destapa precios es **invisible en `leads`**: vive en `public.users` como `warm`.

**Infra de mail:** Resend, 3 senders server-side: `lib/email/lead.ts` (marca+cliente),
`lib/email/otp.ts` (código), `lib/email/welcome.ts` (**ya existe**; hoy sólo lo dispara `GET /verify`
para la tanda UOCRA, gateado por `welcome_sent_at`). **No hay cron/drip en CF.**
`re_engagement_trigger` = columna **muerta** (0 referencias en código).

**Sin flag de plan por marca:** sólo existe `NEXT_PUBLIC_XIMIA_ENABLED` **global** + `XIMIA_LIVE=false`
hardcoded. No hay distinción CF vs CF+Ximia por marca.

**Sin precalificación web:** `submitLead` nunca corre el motor ni llama a Ximia. El qualifier
(`scripts/qualify_leads.sql`) es manual y scopeado a `sindicato_uocra`. Los 52 web tienen `qualifies=null`.

**Entra spam por el form** (ej. lead "Dannie / virtue.dannie@gmail.com" con mensaje SEO basura, 2026-07-17).

## 3. Los 3 segmentos y sus workflows

Orquestador = **n8n** (mismo runtime que Ximia, cron nativo). CF **emite eventos**; n8n **decide y actúa**.
Ruteo determinístico por `source` / `lead_type` / `marcas.plan` (GOLDEN RULE: la lógica en código, no en el prompt).

### A · Curioso (registró para ver precios)
- **Hoy:** fila `public.users` `warm`, sin bienvenida, sin seguimiento.
- **Objetivo:** saludarlo y **empujarlo a ser lead**. NO ensuciamos `leads` con curiosos: se promueve a
  lead recién cuando hace "Quiero esta casa".
- **Disparo:** evento `otp_verified` desde CF → n8n.
- **Secuencia:** bienvenida (día 0) → nudge (día 2-3) → re-engagement (día 7, cablea `re_engagement_trigger`)
  → newsletter mensual. Cualquier avance (clic en casa) lo saca del nurture y lo promueve a lead.

### B · "Quiero esta casa", marca `plan='cf_ximia'`
- **Objetivo:** que **Ximia precalifique** y la marca reciba un lead **caliente y calificado**.
- **Disparo:** evento `lead_created` con `marca.plan='cf_ximia'`.
- **Secuencia:** bienvenida + invitación a Ximia ("en 3 min sabés cuánto financiás") → Ximia corre el
  motor → si califica: **notificación enriquecida a la marca** (ver §6) + alerta a asesora → seguimiento de venta.

### C · "Quiero esta casa", marca `plan='cf'` (sólo CF)
- **Objetivo:** que CF no deje caer la imagen aunque la venta la haga la marca.
- **Disparo:** evento `lead_created` con `marca.plan='cf'`.
- **Secuencia:** bienvenida de marketplace (día 0, independiente de la marca) → la marca recibe su aviso
  (ya pasa hoy) → **SLA 48h: touch cordial de CF** ("¿te contactaron? ¿cómo fue tu experiencia?") que
  **doblea como QA** de la atención de la marca. Escalar si el lead dice "no me contactaron".
- **Decisión (Andrea):** el touch de 48h es incondicional (opción c) — no dependemos de una señal de
  "la marca contactó" que hoy no existe; y el QA nos suma a todos.

## 4. Cadencia de nurture (basada en benchmarks de email/lead marketing)

Principios: **regla de los 5 min** (responder inbound al toque multiplica la calificación),
bienvenidas rinden ~3-4x un envío común, serie de bienvenida = 3-5 toques en 1-2 semanas, y una casa
es **alta consideración** → toques espaciados, no densos. El spacing es criterio afinado; revisable.

| Segmento | Día 0 (inmediato) | +2-3 días | +7 días | Después |
|---|---|---|---|---|
| A · Curioso | Bienvenida "ya ves los precios de X" + cómo funciona CF | Nudge: casas destacadas | Re-engagement: "hablá con Ximia" | Newsletter mensual |
| B · cf_ximia | Bienvenida + invitación a Ximia | Recordatorio Ximia si no interactuó | (calificado → sale del nurture) | según outcome |
| C · cf only | Bienvenida marketplace | — (la marca atiende) | — | — |
| C · SLA | — | **48h: touch cordial + QA** | escalación si "no me contactaron" | — |

## 5. Cambios de modelo de datos

- **`marcas.plan`** enum `('cf','cf_ximia')` default `'cf'` — quién contrató sólo CF vs CF+Ximia. (mig. 0097)
- **`marcas.price_visibility`** enum `('public','gated','hidden')` default `'gated'` — política de precios
  **por marca**, configurable y cambiable. `gated` = el curioso debe registrarse (OTP) para ver precios →
  lo capturamos. Hausind → `gated` (pedido de Guillermo). **Supersede `show_prices`**; la migración del
  código que lee `show_prices` queda pendiente (§7). (mig. 0097)
- **Fix atribución** `marca_id` en `components/LeadForm.tsx` (1 línea) — tapa los huérfanos.
- **`re_engagement_trigger`** — cablearla (hoy muerta) desde el nurture n8n.

## 6. Notificación enriquecida a la marca (Segmento B) — "Ximia debe brillar"

Cuando Ximia precalifica, la marca NO recibe la notificación pelada de hoy, sino un lead con TODO lo
importante: **crédito estimado** (monto/plazo/cuota/línea, del motor), **casa(s) de interés**, **horizonte
de compra**, **anticipo disponible**, y el **scoring + nivel de interés + análisis de Ximia** (el read
de la conversación). Es el diferencial: la marca recibe un lead accionable, no un mail.

## 7. Ítems abiertos / a confirmar

1. ~~¿Hausind es `cf` o `cf_ximia`?~~ **RESUELTO (Andrea, 2026-07-17): `cf_ximia`** (flagship + piloto de
   Ximia). La mig. 0097 lo setea. Ojo: Ximia aún no live (`XIMIA_LIVE=false`) → el ruteo B queda armado,
   el paso de precalificación se enciende al prender Ximia.
2. **Discrepancia `show_prices`:** Hausind tiene `show_prices=false` en DB, pero Andrea reporta que la
   comparativa de precios se ve. Verificar qué controla realmente `show_prices` en el catálogo antes de
   migrar el código al enum.
3. **Anti-spam:** captcha/antispam a nivel form lo toma **Andrea en la sesión del catálogo** (paralelo).
   Del lado engagement: **guard server-side** para que el junk no dispare workflows ni alerte asesoras.
4. **Contenido exacto** de cada mail (copy) — pendiente de redacción por segmento.

## 8. Orden de construcción

1. ~~**Migración `0097`**~~ ✅ **HECHO** — `marcas.plan` + `marcas.price_visibility` (Hausind cf_ximia + gated).
2. ~~**Fix atribución `marca_id`**~~ ❌ **DESCARTADO** — no era bug: los 45 null vinieron del form genérico `/cotizar` (sin casa), atribución correcta.
3. ✅ **HECHO — CF emite eventos a n8n** (el productor): `lib/engagement/emit-event.ts` (best-effort, await c/timeout 3s, nunca rompe el flujo). Enganches: `verifyOTP` → `otp_verified` (A) · `submitLead` → `lead_created` (B/C/D). Contrato en §… (ver arriba). **Pendiente para activar:** setear `N8N_ENGAGEMENT_WEBHOOK_URL` (+ opcional `N8N_ENGAGEMENT_SECRET`) en Vercel/.env.
4. **Workflows n8n** A/B/C/D — el cerebro (webhook receptor + JOIN a `marcas.plan` + cron + secuencias). ← **SIGUIENTE**.
5. **Precalificación web** — conectar el motor / Ximia a los leads de marca (gap grande del Segmento B).

> **Nota (paralelo):** el **antispam de `/cotizar` ya está implementado** (Andrea, sesión catálogo): honeypot `hp_website` + Cloudflare Turnstile (`lib/anti-spam/turnstile`) + rate-limit IP+email (`lib/anti-spam/rate-limit`), los 3 ANTES de escribir a DB → el junk no llega a `leads` ni dispara el evento `lead_created`. Cubre el guard server-side que pedía el diseño.

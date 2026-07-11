# Ximia: salir de Botpress → widget propio en el catálogo

> **Decisión (2026-06-18):** desprenderse de Botpress y embeber un **widget de chat propio
> dentro de este Next.js**, que le pegue directo al webhook de n8n. Motivos: Botpress hoy
> duplica lo que n8n ya hace, arrastra peso muerto de v1, **no puede pasar la identidad del
> usuario logueado**, su auth está partido en dos sistemas ("apenas anda"), y cuesta $20/mes.
> El cerebro ya vive en n8n (agente + memoria + tools + persistencia); el frontend solo tiene
> que ser **delgado**.

Este doc es autocontenido: con esto se puede construir sin reabrir la sesión de Ximia.

---

## 0) Por qué Botpress se va (contexto de 1 línea)
El nodo `Forward_to_n8n` de Botpress se llama "transport only" pero es un **adaptador de v1**:
manda `full_kb_context` (vacío), `step`, `startForm`, maquinaria multi-mensaje (`reply_2..4`,
`auto_continue`) que v2 ya no usa, y un auth distribuido entre `session`/`workflow`. Y **no manda
`user_id`/`email`/`name`** → el registrado es estructuralmente invisible. No es "no anda", es
"no puede andar". Reemplazarlo resuelve identidad (#32), saludo-al-abrir (#1) y el empalme (#38)
de una sola vez, en la capa correcta.

---

## 1) El contrato exacto con n8n (lo que el widget manda y recibe)

**Endpoint (no cambia):**
```
POST https://construirfacil.app.n8n.cloud/webhook/ximia-v2-lab/chat
Content-Type: application/json
```

**Request — body que debe mandar el widget:**
```jsonc
{
  "chatInput": "texto del usuario",   // n8n lee chatInput || text; ambos sirven
  "sessionId": "<id estable por conversación>",  // ver §3 (persistir en localStorage)

  // --- IDENTIDAD (esto es lo que Botpress NO mandaba) ---
  "user_id": "<supabase auth uid>",   // = public.users.id (ver §2). null si anónimo
  "email":   "<email>",               // null si anónimo
  "name":    "<nombre>",              // opcional
  "phone":   "<tel>",                 // opcional

  // --- CONTEXTO DEL CATÁLOGO (agregado 2026-07-10) ---
  // Snapshot vivo de qué está mirando el visitante. Se re-arma en cada turno
  // (no en el START) → si el visitante navega mientras chatea, Ximia lo ve.
  // La historia sigue guardada por sessionId; context es "dato ambiental"
  // paralelo, NO reemplaza la conversación.
  "context": {
    "path":            "/modelos/casa-ejes-cubo-copahue",   // window.location.pathname
    "provincia_id":    "<uuid>",       // useProvincia() en el catálogo. null si el visitante no eligió.
    "provincia_name":  "Neuquén",      // resuelto lado widget para ahorrarle a n8n un JOIN
    "model_slug":      "casa-ejes-cubo-copahue",  // derivado de /modelos/{slug}. null si no está en detalle
    "tiene_lote":      "si"            // 'si' | 'no' | null — leído de localStorage.cf-tiene-lote
  }
}
```
- **Primer turno (al abrir el chat):** mandar `chatInput: "__START__"` → n8n lo trata como
  saludo y Ximia abre la conversación sola (resuelve el saludo-al-abrir, #1).
- n8n ya acepta tanto `chatInput` como `text`, y campos de identidad planos
  (`user_id`/`email`/`name`/`phone`) **o** anidados en `identity`/`user`/`contact`/`lead`.
  Recomendado: planos.
- **`context`** viaja en TODOS los turnos incluído `__START__`. n8n puede resolver
  `model_slug` → `house_catalog` (JOIN por slug canónico) si necesita nombre/línea/precio.
  Si Ximia recibe un `context.model_slug` distinto entre turnos, el visitante navegó
  a otra casa: es señal, no ruido — el prompt decide cuándo mencionarlo.

**Response — lo que devuelve n8n (leer esto):**
```jsonc
{
  "reply": "texto de Ximia",   // ← renderizar esto. v2 devuelve UN solo reply (no arrays)
  // ...además viene el objeto lead completo (bucket, score, etc.) — ignorable por el widget
  "requires_auth": false,      // opcional; ver §4 si querés gatear OTP desde n8n
  "buttons": []                // opcional; quick-replies si algún día se usan
}
```
El widget solo necesita `reply`. Nada de `multi_message_mode`, `step`, `reply_2..4` — eso era v1.

---

## 2) Identidad: el punto que lo hace trivial (YA VERIFICADO)
`public.users.id` es `uuid primary key references auth.users(id)` →
**`public.users.id` === el uid de Supabase Auth.**

Entonces, para un usuario logueado:
```ts
const { data: { user } } = await supabase.auth.getUser();
// user.id  → mandar como user_id   (matchea public.users.id en n8n, enriquecimiento directo)
// user.email → mandar como email
```
n8n hace `select name, phone, email from public.users where id = $user_id::uuid or email = $email`
y usa esos datos reales. **Cero fricción: el registrado queda reconocido y NO se le pide registro.**

---

## 3) Qué hace el widget (spec funcional)
1. **Montarse** en el catálogo como componente React (reemplaza el `<script>` de Botpress).
2. **sessionId estable**: generar uno (uuid) y guardarlo en `localStorage` para que la charla
   sobreviva reloads. (Para logueado, podés derivarlo de `user.id` + fecha, o uuid suelto.)
3. **Al abrir**: POST con `chatInput:"__START__"` + identidad → renderizar el saludo.
4. **Por cada mensaje**: POST con `chatInput` + `sessionId` + identidad (de `supabase.auth`).
5. **Renderizar** `response.reply`. Indicador de "escribiendo…" mientras espera.
6. **Identidad automática**: si hay sesión Supabase, adjuntar `user_id`/`email`/`name` siempre.
   Si no hay sesión → anónimo (campos null), charla igual (ver §4 para OTP).

---

## 4) Auth del anónimo (OTP) — en la capa correcta
Hoy no todos llegan logueados: muchos van a querer charlar **antes** de registrarse. Eso está bien
(charla libre). El OTP se necesita solo si en algún punto queremos **identidad verificada** (p.ej.
antes de cerrar/agendar). Hacerlo con **Supabase Auth**, que ya tenés:
- Magic link / OTP por email de Supabase (`supabase.auth.signInWithOtp`).
- Ya existe `0061_email_verifications_auth_gate.sql` (tabla de verificación) para reusar si hace falta.
- Disparador: el widget decide app-side, **o** n8n lo pide vía `requires_auth:true` en la respuesta
  (el agente puede señalar "acá conviene verificar"). Decisión de diseño para la sesión.

Esto reemplaza el `Auth_Gate`/`requires_auth` partido de Botpress por algo estándar y nativo.

---

## 5) Dos cosas a verificar/setear ANTES (para no llevarse sorpresas)
1. **CORS.** Botpress llamaba a n8n desde su backend; el widget llama **desde el navegador**
   (cross-origin a `*.n8n.cloud`). Hay que setear `allowedOrigins` en el nodo **`Ximia — Chat`**
   (chatTrigger) del workflow `ximia-v2-lab` (id `SJMXHrIitAkTePAI`) → agregar el dominio del
   catálogo. *(Esto es del lado n8n — avisame y lo dejo seteado, o se hace desde la UI de n8n.)*
2. **OTP**: decidir si lo dispara el widget o n8n (§4). Para el MVP puede no haber OTP (charla
   libre + identidad de logueados) y agregarlo después.

---

## 6) Cómo arrancar (recomendado: spike primero)
- **Paso 1 — Spike de-risk (1-2h):** usar `@n8n/chat` (widget oficial de n8n, habla nativo el
  protocolo del chatTrigger) apuntando a `ximia-v2-lab`, pasando `user_id` por su campo `metadata`.
  Objetivo: confirmar **CORS OK + identidad llega + reply renderiza** end-to-end. Sin UI fina.
- **Paso 2 — Widget branded:** una vez confirmado el camino, construir el componente propio con
  la estética de ConstruirFácil (o seguir con `@n8n/chat` estilizado si alcanza).
- **Paso 3 — Apagar Botpress:** recién cuando el widget propio funcione en prod. **No tocar el
  webhook `ximia-v2-lab`** (lo sigue consumiendo el widget nuevo). Quitar el `<script>` de Botpress
  y dar de baja la suscripción ($20).

**Bonus:** la historia de la charla se puede rehidratar desde `leads.transcript_json` (ya se
persiste por `session_id`) → el widget puede mostrar la conversación previa al volver.

---

## 7) Estimación honesta
- n8n: **casi nada** (acepta `text`/`chatInput`, devuelve `reply`; solo falta `allowedOrigins`).
- Widget: el grueso es la UI. Spike ~1-2h; v1 sólido ~1 día; branded un poco más.
- Deploy: es del founder (construirfacil.com), como siempre.

## 8) Decisiones abiertas para la sesión del catálogo
- ¿`@n8n/chat` estilizado alcanza, o querés componente 100% propio branded?
- ¿OTP en el MVP, o charla libre + identidad de logueados primero y OTP después?
- ¿Rehidratar historial desde `transcript_json` en v1, o dejarlo para después?

> **Referencias cruzadas:** el lado n8n del agente está en `~/Projects/XIMIA` (workflow lab
> `SJMXHrIitAkTePAI`, doc `docs/HANDOFF_2026-06-17.md`). El `Forward_to_n8n` de Botpress que se
> reemplaza quedó analizado en la sesión de Ximia del 2026-06-18.

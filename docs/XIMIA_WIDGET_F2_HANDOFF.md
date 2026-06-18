# Ximia widget — handoff F2 / F3 (2026-06-18)

> Sesión cerrada con F0 + F1 funcionando. F2 bloqueado por trabajo del lado n8n.
> F3 listo para ejecutar una vez que F2 cierre.

## Estado del repo
- Branch: `ximia-widget-spike` (commit `4bd5fe0`, pusheada a `origin`).
- `main` no recibe nada hasta cerrar F2 + F3.
- Webhook hardcoded como fallback en el componente; `NEXT_PUBLIC_XIMIA_WEBHOOK_URL` lo overrides.

## Cómo retomar mañana
```bash
git checkout ximia-widget-spike
npm run dev   # http://localhost:3000
```
Abrir cualquier URL del catálogo. El FAB con el GIF aparece arriba a la derecha.
Para probar el flow anónimo: ventana incógnito.

## Lo que YA funciona (F1 MVP)
- `<XimiaWidget>` global en `app/layout.tsx`, oculto en `/admin/*`.
- `/api/ximia/identity` combina cookie `cf_client` + `auth.users` → devuelve `{ user_id, email, source }`.
- Body PLANO al webhook n8n (`chatInput`, `sessionId`, `user_id`, `email`, `name`, `phone`). Confirmado en logs n8n.
- `sessionId` en `localStorage` (`cf_ximia_session_id`) → sobrevive reloads.
- `__START__` se manda solo la primera vez que se abre el chat en la sesión.
- Typing indicator visible desde el momento del open (no espera al fetch).
- Foco devuelto al input después de cada respuesta.
- Log dev del JSON crudo de la response: `[Ximia] turn Xms\n{json}` en `console.info`.

## F2 — qué FALTA del lado n8n (lo hace Andrea)

El widget está **listo para reaccionar**. Lo que necesita el agente:

### Contrato esperado en la response

| Momento del flow | Shape esperado en la response |
|---|---|
| Decide que es momento de pedir auth | `requires_auth: true` (ya existe el flag, hoy emite `false` aunque pida email en el reply) |
| El user respondió con email (DE lo extrae) | `auth: { action: "request", email: "x@y.com", name: "Andrea" }` |
| El user respondió con código (DE lo extrae) | `auth: { action: "verify", email: "x@y.com", code: "4821" }` |

El widget intercepta `auth.action`:
- `"request"` → llama Server Action `requestOTP({ email, name })`. Manda mail con código de **4 dígitos**.
- `"verify"` → llama Server Action `verifyOTP({ email, code })`. Si OK, setea cookie `cf_client`. El widget refetch `/api/ximia/identity` y los siguientes turnos van con `user_id`/`email` reales.

### Por qué la sesión incógnito de hoy no disparó OTP

En el turno donde el user respondió con email, n8n emitió:
```jsonc
{
  "reply": "¡Excelente, ya te agendé con ese correo!...",
  "requires_auth": false,
  "_engagement": "vague",
  "_integrity": { "assertsCredit": false, "financingToolRan": false, ... },
  "_redteam": { "leaked": false, "marker": null }
}
```
- `requires_auth` siguió en `false` aunque el agente sí venía pidiendo el email.
- El agente trató el email como contact info para reunión, no como trigger de OTP.
- Falta conectar el branch de auth al flow conversacional + extraer email/código con el DE.

## F2 — qué falta del lado WIDGET (lo hago yo cuando n8n esté listo)

~30 líneas adicionales a `components/ximia/XimiaWidget.tsx`:

```tsx
// pseudocódigo
const auth = data?.auth
if (auth?.action === 'request' && auth.email) {
  await requestOTP({ email: auth.email, name: auth.name ?? '' })
} else if (auth?.action === 'verify' && auth.email && auth.code) {
  const r = await verifyOTP({ email: auth.email, code: auth.code })
  if (r.ok) {
    // Cookie cf_client ya seteada por el Server Action
    refetchIdentity()
  }
}
```

Los Server Actions `requestOTP` y `verifyOTP` viven en `app/(auth)/gate/actions.ts:40` y `:108`. **No requieren cambios.**

## F3 — cierre completo (orden sugerido)

1. F2 enchufada y validada con un round-trip completo en incógnito.
2. Setear `NEXT_PUBLIC_XIMIA_WEBHOOK_URL` en Vercel (preview + prod).
3. En la sesión n8n: `allowedOrigins` del chatTrigger `ximia-v2-lab` (`SJMXHrIitAkTePAI`) incluye el dominio Vercel preview + `construirfacil.com`.
4. Borrar `public/ximia-lab-botpress.html`.
5. Borrar comentarios "// reemplaza Botpress" del código.
6. Borrar este doc (`XIMIA_WIDGET_F2_HANDOFF.md`) — cumplió su rol.
7. PR `ximia-widget-spike` → `main`.
8. Andrea: dar de baja la suscripción de Botpress ($20/mes ahorrados).

## Archivos clave
- `app/api/ximia/identity/route.ts` — endpoint server-side identidad
- `components/ximia/XimiaWidget.tsx` — componente principal
- `components/ximia/XimiaWidget.module.css` — estilos branded
- `app/(auth)/gate/actions.ts` — Server Actions `requestOTP`/`verifyOTP` para reuso
- `docs/XIMIA_WIDGET_MIGRATION.md` — plan original (decisiones de arquitectura)
- `public/AI-Icon.gif` — avatar del FAB y mensajes
- `public/ximia-lab-botpress.html` — backup del Botpress legacy (a borrar en F3)

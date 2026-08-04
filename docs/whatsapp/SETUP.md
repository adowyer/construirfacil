# WhatsApp Business API — estado del alta

> Alta hecha el **2026-08-04**. Este archivo registra QUÉ existe y POR QUÉ está así.
> **Ningún secreto vive acá.** Los tokens van a `.env.local` (gitignored); el PIN, al gestor
> de contraseñas de Andrea.

## Identificadores (no son secretos, pero no hacen falta en público)

| Pieza | Valor |
|---|---|
| Business portfolio | `ConstruirFácil` — ID `970063856050752` |
| App de Meta | `ConstruirFacil Mensajeria` — App ID `1537498198109522` |
| WhatsApp Business Account (WABA) | `4431364397131266` |
| Phone Number ID | `1272262562632650` |
| Número | +54 9 11 7145-8369 (chip dedicado, comprado solo para esto) — `CONNECTED` |
| System user | `CF Mensajeria API` — ID `61593041933685` |
| Display name | **ConstruirFácil** |
| Categoría / Timezone | Professional Services · America/Argentina/Buenos_Aires |

## Decisiones tomadas y por qué

- **Meta Cloud API directo, no un BSP** (360dialog / Wati / Twilio). Los BSP cobran abono +
  markup para tapar una parte técnica que n8n ya resuelve con su nodo nativo. Además deja el
  camino abierto para que Ximia conteste por este canal.
- **App nueva, separada de la del catálogo.** No fue solo higiene: Meta **desactiva Facebook
  Login cuando agregás el caso de uso de WhatsApp** — no se pueden combinar en la misma app.
  La app del login del catálogo (`FACEBOOK_APP_ID`) queda intacta.
- **App contact email = `adowyer@gmail.com`**, no `hola@`. Ahí Meta avisa restricciones de app,
  y `hola@` reenvía a `hola@construirfcil.hs-inbox.com` → un aviso de restricción se perdería
  en el timeline de HubSpot entre respuestas de leads.
- **Business email del portfolio = `hola@construirfacil.com`** (institucional, es el que Meta
  mira en la verificación). Confirmado el 2026-08-04.
- **Verificación de negocio: pendiente a propósito.** Requiere documentación legal y todavía no
  está definida la entidad (CUIT propio vs. otra razón social vs. monotributo). No bloquea el
  alta; solo el volumen — ver abajo.

## Límites que condicionan el plan de envío

- **Tier 0 (sin verificación de negocio): 250 personas NUEVAS por 24 h.** Con ~321 leads en
  HubSpot son 2 días. Con verificación sube a 2.000.
- Desde **oct-2025 el límite es por business portfolio**, no por número: agregar un segundo
  número no duplica el cupo.
- Meta reevalúa cada 6 h y sube de tier si la calidad se mantiene Media/Alta y usaste el 50%
  del límite en los últimos 7 días.
- **Los límites aplican solo a mensajes iniciados por la empresa.** Responder dentro de la
  ventana de servicio de 24 h es ilimitado **y gratis**. Por eso las plantillas invitan a
  responder: cada respuesta abre esa ventana.

## Precio (revisar antes de prometer números)

Desde el **1-jul-2025 se cobra por mensaje entregado**, no por conversación. Utility global va
de USD 0,004 a 0,046. **Argentina tiene rate card propio** — bajar el CSV oficial de Meta antes
de cotizar. La estimación vieja de "USD 0,03–0,05" que circuló en julio-2026 era del modelo
anterior y quedó alta.

## 🧨 El `Register` del panel de developers MIENTE — usá la API

El botón **Register** del panel de developers falló **tres veces sin mostrar un solo error**:
cerraba el cuadro del PIN y el número seguía en `Not registered`. Recargar la página confirmaba
que no era estado viejo en pantalla: la operación no se había hecho.

La MISMA operación por Graph API funcionó **al primer intento**, y en el camino devolvió errores
legibles (`code 100 · Parameter pin must be a 6-digit string` cuando el placeholder viajó sin
reemplazar). El panel se come la respuesta de Meta; la API te la da.

```bash
# registrar (crea el PIN de 2FA la primera vez)
curl -s -X POST "https://graph.facebook.com/v23.0/$PHONE_NUMBER_ID/register" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"<6 dígitos>"}'
```

**Antes de gastar un intento, consultá el estado — es gratis y no cuenta:**

```bash
curl -s "https://graph.facebook.com/v23.0/$PHONE_NUMBER_ID?fields=status,platform_type,name_status,code_verification_status&access_token=$WHATSAPP_TOKEN"
```

Cómo leer la respuesta:

| Campo | Sin registrar | Registrado |
|---|---|---|
| `status` | `PENDING` | `CONNECTED` |
| `platform_type` | `NOT_APPLICABLE` | `CLOUD_API` |
| `throughput.level` | `NOT_APPLICABLE` | `STANDARD` |

⚠️ **El endpoint de registro admite 10 intentos por número cada 72 h.** Al pasarse devuelve
`133016` y **bloquea el número 3 días**. Por eso NUNCA se reintenta a ciegas desde el panel:
cada clic mudo consume presupuesto sin decirte nada. Consultá primero, registrá una vez.

**Hipótesis que se cayeron por mirar los datos** (quedan anotadas para no volver a perseguirlas):
el display name NO estaba en revisión (`name_status: AVAILABLE_WITHOUT_REVIEW`), la cuenta NO
estaba en sandbox (`account_mode: LIVE`), y la falta de método de pago NO impide registrar —
eso último aparece en blogs, no en la doc de Meta.

## Qué bloquea de verdad la falta de verificación de negocio (2026-08-04)

La SA de ConstruirFácil está recién formada y **todavía no tiene CUIT**, así que la
verificación de negocio no se puede iniciar. Conviene tener claro qué frena eso y qué no,
porque es mucho menos de lo que parece:

**NO bloquea** — todo esto funciona hoy:
- Mandar a los ~321 leads. `TIER_250` = 250 personas nuevas por 24 h → **la tanda entera
  sale en 2 días**. El objetivo principal del canal no espera nada.
- La plantilla Utility (su aprobación no depende de la verificación).
- El webhook: la app quedó **publicada** el 2026-08-04, que era el requisito real. Publicar
  solo pedía **URL de política de privacidad** (`/privacidad`) y borrado de datos
  (`/data-deletion`), las dos ya existían en el sitio. **No pide verificación de negocio.**

**SÍ bloquea:**
- Subir a `TIER_2000` (cómodo, no necesario para esta tanda).
- Las **plantillas de autenticación** → y con eso, el OTP por WhatsApp, que era la solución
  de identidad elegida para convertir el teléfono en llave fuerte. **Ese proyecto sí espera
  al CUIT de la SA.**
- Pasar de 2 a 20 números.

Estado medido contra la API, no supuesto:

| Campo | Valor |
|---|---|
| `messaging_limit_tier` | `TIER_250` |
| `quality_rating` | `GREEN` |
| `status` | `CONNECTED` |
| WABA `account_review_status` | `APPROVED` |
| WABA `business_verification_status` | `not_verified` |

⚠️ La constancia de ARCA de una **persona física** no sirve para verificar: no coincide con
el `Legal business name`, puede decir "no registra impuestos activos", y sobre todo **no trae
domicilio fiscal** — Meta exige nombre legal y dirección en el MISMO documento.

## Lo que falta

1. **Método de pago** (lo carga Andrea; sin tarjeta Meta no habilita mensajes iniciados por la
   empresa — que es exactamente lo que necesitamos para los leads). No bloquea el registro del
   número, sí el envío.
2. **Plantillas** — borradores en `PLANTILLAS.md`, a presentar en WhatsApp Manager.
4. **Webhook** hacia n8n (callback URL + verify token). ⚠️ Meta solo entrega datos de producción
   **si la app está publicada**; mientras esté unpublished llegan solo webhooks de prueba.
5. **Confirmar el texto de consentimiento de la ficha del sindicato**: Meta acepta opt-in
   general, pero exige que el texto **nombre a la empresa** y que se pueda evidenciar
   (timestamp + canal + texto exacto + teléfono). Si la ficha nombra solo al sindicato, hay que
   resolverlo ANTES del primer envío.

## Gotcha de nombres

Meta **rechaza sus propias marcas** en el nombre de la app y del system user: `CF WhatsApp API`
dio *"invalid System User name"*. Tampoco acepta varios guiones (`cf-whatsapp-api` → *"names
can't have too many hyphens"*). Por eso la app se llama `ConstruirFacil Mensajeria` y el system
user `CF Mensajeria API`. El nombre que ve el cliente (`ConstruirFácil`) es otro campo — el
display name del número — y ahí el acento sí se acepta.

## Gotcha argentino

El formato internacional de los celulares de acá lleva un `9` (`+54 9 11 ...`) que Meta a veces
normaliza y a veces no. El alta se hizo cargando `11 7145-8369` **sin** el 9 y funcionó — el SMS
llegó. Si en algún envío el número destino rebota, probar la variante con `9` antes de suponer
que el lead no tiene WhatsApp.

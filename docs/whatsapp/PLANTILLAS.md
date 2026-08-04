# Plantillas de WhatsApp — ConstruirFácil

> Estado al 2026-08-04:
> - `confirmacion_registro` → **PRESENTADA**, id `1584901370013366`. La buena.
> - `aviso_credito_disponible` → id `27990102570675778`, **recategorizada a MARKETING**.
>   Se borra cuando la nueva quede aprobada; hasta entonces se deja viva como red.
> - `verificacion_codigo` → **BLOQUEADA**. Ver abajo.
>
> 🧨 **La categoría que devuelve el POST es una INTENCIÓN, no un veredicto.** Al presentar
> `aviso_credito_disponible` la API contestó `"category": "UTILITY"` — y en la revisión Meta la
> pasó a `MARKETING`. Marketing cuesta varias veces más por mensaje y pesa peor en el quality
> rating. **La categoría real se lee después, consultando `message_templates`**, no en la
> respuesta de la creación.
>
> **Qué la hizo caer en Marketing:** el cuerpo decía *"Ya calculamos el crédito que te
> corresponde… Confirmá tu registro para verlo"*. Eso se lee como oferta ("tenemos algo para
> vos, vení"). Utility es *"esto que empezaste necesita un paso tuyo"*. La diferencia está en
> el encuadre, no en el link ni en el botón.
>
> Se crean por API, no por el panel (mismo motivo que el `register`: el panel se come los
> errores). `POST /{WABA_ID}/message_templates`.
>
> Regla de oro: la categoría la decide Meta, no nosotros. Si Meta reclasifica una Utility como
> Marketing, el precio sube y la entrega cae. Por eso el texto NO vende: notifica.

## Contexto que condiciona el texto

- **Idioma:** `es_AR`. El bot le habla al cliente en español rioplatense (voseo). Es la regla de
  voz del proyecto: instrucción en inglés, output al usuario en español.
- **Opt-in:** Meta acepta consentimiento general si el texto nombra a la empresa y se puede
  evidenciar (timestamp + canal + texto exacto + teléfono). Para el sindicato eso es la ficha
  firmada + `leads.consent_captured_at`.
- **Baja:** toda plantilla de notificación lleva salida explícita. Además de ser correcto, baja
  el ratio de "bloquear/reportar", que es lo que hunde el quality rating del número.

---

## 1. Utility — aviso de que salió el mail del crédito

**Nombre interno:** `aviso_credito_disponible`
**Categoría:** Utility
**Idioma:** `es_AR`

### Body

```
Hola {{1}}, te escribimos de ConstruirFácil.

Ya calculamos el crédito que te corresponde según los datos de tu ficha: monto,
plazo y cuota estimada.

Confirmá tu registro para verlo.
```

| Variable | Contenido | Ejemplo |
|---|---|---|
| `{{1}}` | `leads.first_name` (solo el nombre, nunca el nombre completo en mayúsculas del OCR) | `Margarita` |

### Footer (máx. 60 caracteres — Meta rechaza más)

```
Contacto autorizado en tu ficha. Respondé BAJA para salir.
```

### Botón URL dinámico

```
Confirmar mi registro → https://www.construirfacil.com/verify?c=wa&u={{1}}
```

`{{1}}` del botón = el token firmado `<leadId>.<hmac>` que ya genera `verificationToken()`
(`lib/auth/verify-token.ts`) y replica el mailer en Python (`send_engagement.py`, dominio
`verify:`). **El sender de WhatsApp reusa ese mecanismo — no se firma nada nuevo.**

⚠️ **`?c=wa` va ANTES de `?u=`** porque Meta exige que la variable quede al final de la URL.
Ese parámetro es lo que hace que `app/verify/route.ts` guarde `verified_channel='whatsapp'`
(migración `0109`).

### Por qué está redactada así

- **No promete un monto en el mensaje.** La cifra vive detrás del link, calculada por el motor.
  Poner un número acá repetiría el error de los 7 leads sobrecotizados: si el monto cambia, el
  WhatsApp queda como una promesa vieja que nadie puede retirar.
- **No dice "aprobado" ni "te otorgamos".** Dice *el crédito que te corresponde según tus datos*.
  Es lo que el motor calcula, ni más.
- **Verifica desde WhatsApp, no manda al mail** (decidido 2026-08-04). El diagnóstico de julio
  fue que el mail es un canal roto para esta población: 3% verificado, direcciones tomadas por
  OCR de manuscrito. Un WhatsApp que empuja al correo empuja al canal que no funciona.

---

## 2. Authentication — OTP para verificar el teléfono

**Nombre interno:** `verificacion_codigo`
**Categoría:** Authentication
**Idioma:** `es_AR`

> 🚫 **BLOQUEADA hasta la verificación de negocio** (probado 2026-08-04). El intento de crearla
> devolvió `code 10 · subcode 2388185 · "This WhatsApp business account does not have permission
> to create message template"`. **No es el token ni el formato**: la Utility se creó bien con el
> mismo token un minuto antes; lo único que cambia es la categoría.
>
> **Qué sabemos y qué no**, para que nadie persiga fantasmas después:
> - HECHO: el error existe y es específico de la categoría AUTHENTICATION.
> - HECHO: lo único que le falta a esta cuenta es la verificación de negocio.
> - HIPÓTESIS FUERTE (no confirmada en la doc de Meta): la verificación es el gate. Es lo que
>   reportan los proveedores y encaja con el único requisito que nos falta. **Se comprueba
>   reintentando la creación después de verificar** — no hay forma de saberlo antes.
> - DESCARTADO: circula que hacen falta ~1.000 conversaciones diarias por número. **No está en
>   la doc de Meta.** La cifra real que sí existe (750K mensajes / 30 días) es para *tarifas
>   internacionales de autenticación*, que es otro tema. No planificar contra ese número.
>
> **Consecuencia de cadena, que conviene tener clara:** el OTP por WhatsApp era la solución de
> identidad preferida (opción 5 — promover el teléfono a llave fuerte y cerrar el agujero de
> duplicados en origen). Esa solución depende de la verificación de negocio, que depende de
> definir la entidad legal de ConstruirFácil. **Mientras eso no se resuelva, el anti-duplicados
> sigue apoyado en el puente, no en el candado.**
>
> Meta tiene formato fijo para authentication: cuerpo predefinido + botón de copiar código.
> No se puede redactar libre. Lo que sí se elige es el add-on de expiración y el botón.

- **Tipo:** código de un solo uso
- **Botón:** copiar código (`copy_code`)
- **Expiración:** 10 minutos (se muestra en el mensaje)
- **Variable:** `{{1}}` = el código de 6 dígitos

### Para qué es

Es la pieza que promueve el **teléfono a llave fuerte** en `resolve_user`. Hoy el email es una
llave rota para la población del sindicato (OCR de manuscrito, 3% verificado); el teléfono es
el canal que sí usan. Con OTP confirmado, la regla queda:

> teléfono verificado **fusiona**, salvo que haya DNI distinto en las dos filas.

Nunca al revés: una llave verificada no pisa a una llave más fuerte que la contradice.

---

## ✅ El consentimiento — VERIFICADO 2026-08-04

Texto literal de la ficha firmada del sindicato:

> «Autorizo a **construirfacil.com** a guardar y tratar estos datos con el fin de **evaluar mi
> acceso a financiación de vivienda** y a **contactarme por WhatsApp o teléfono**. Puedo
> solicitar la consulta, rectificación o baja de mis datos en cualquier momento. *(Ley 25.326
> de Protección de Datos Personales)*.»
> ☑ Sí, autorizo — con **firma, aclaración y fecha**.

Cumple de sobra lo que Meta exige (nombrar a la empresa + poder evidenciarlo con timestamp,
canal, texto exacto y teléfono). De hecho **nombra WhatsApp explícitamente**, que es más fuerte
que el opt-in general que Meta acepta como mínimo.

### 🚧 El límite: es un consentimiento CON PROPÓSITO

Autoriza el contacto **para evaluar el acceso a financiación de vivienda**. Eso cubre:
- ✅ Confirmar el registro de la postulación (la plantilla `confirmacion_registro`).
- ✅ Responder consultas dentro de la ventana de servicio.
- ❌ **Promocionar modelos de casas, cupos, descuentos o novedades del catálogo.**

**Por eso la categoría importa más que por plata.** Cuando Meta recategorizó la primera
plantilla a MARKETING, el problema no era sólo que sale más cara: **un mensaje de categoría
Marketing a esta lista excede el propósito que la gente autorizó.** Volver a Utility alinea el
mensaje con el permiso que realmente existe.

**Retención de la prueba:** Meta pone la carga de la prueba del lado nuestro. Las fichas
escaneadas son la evidencia y tienen que seguir siendo recuperables **por `lead_id`** — no
alcanza con tenerlas en una carpeta suelta.

## Antes de presentarlas
2. **`{{1}}` tiene que salir limpio.** Los nombres del OCR vienen en mayúsculas y a veces con el
   apellido pegado. Un "Hola MARGARITA MATTO GRISELDA," se lee como spam automático.
3. Meta rechaza plantillas con variables al inicio o al final del body sin texto alrededor, y
   las que tienen dos variables seguidas. Ninguna de las dos cae en eso.

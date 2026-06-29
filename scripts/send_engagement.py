#!/usr/bin/env python3
"""
send_engagement.py — primer touch comercial (mail-first) a los leads UOCRA
consentidos, segmentado por bucket. Resend para el envío, Supabase como guard
de idempotencia, HubSpot como log del touch (best-effort).

REGLAS DURAS:
  - Solo envía a leads CONSENTIDOS (consent_captured_at not null). Ley 25.326.
  - Solo bucket READY / QUALIFIES_LATER. (Sin consent / data-quality NO.)
  - EXCLUYE unsubscribed=true (baja one-click). NUNCA re-mailear a un dado de baja.
  - Idempotente: solo WHERE engagement_sent_at is null; setea el timestamp al
    enviar OK. Re-correr no re-envía.
  - DRY-RUN por defecto. --commit envía.

Unsubscribe one-click: link firmado por lead (HMAC, mismo secret que la ruta TS
/unsubscribe → leads.unsubscribed=true) + header List-Unsubscribe-Post (RFC 8058).
⚠️ El secret (CF_GATE_SECRET || SUPABASE_SERVICE_ROLE_KEY) debe ser el MISMO acá
   (local) y en la ruta (Vercel). Hoy ambos caen al service_role (mismo proyecto
   Supabase) → matchea. Si seteás CF_GATE_SECRET en Vercel, seteálo también local.

Creds: .env.local (RESEND_API_KEY, RESEND_FROM_EMAIL) + .env (SUPABASE_*, HUBSPOT_TOKEN).
NUNCA imprime secretos; PII enmascarada en el output.

Uso:
    python3 send_engagement.py                 # DRY-RUN (no envía nada)
    python3 send_engagement.py --commit        # ENVÍA + marca + loguea
    python3 send_engagement.py --bucket READY  # filtra a un bucket
    python3 send_engagement.py --test a@b.com  # muestra de cada bucket a una dir
"""
import hashlib, hmac, json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

CF = Path.home() / "Projects" / "CONSTRUIRFACIL"
UNSUB_BASE = "https://www.construirfacil.com/unsubscribe?u="
VERIFY_BASE = "https://www.construirfacil.com/verify?u="

# ════════════════════════════════════════════════════════════════════════
#  TEMPLATES — copy final aprobado. {nombre} = primer nombre del lead.
#  El footer (logo + disclaimer + baja one-click) lo agrega _WRAP en render().
# ════════════════════════════════════════════════════════════════════════
# Botón "Verificar mi cuenta" + link de respaldo. Va EN EL CUERPO (donde el
# doc de los SH lo ubica): después del "último paso", antes de "elegí el modelo".
_BTN = ('<div style="text-align:center;margin:28px 0">'
        '<a href="{verify_url}" style="display:inline-block;padding:14px 32px;background:#ff003d;'
        'color:#ffffff;font-weight:bold;font-size:16px;text-decoration:none;border-radius:6px">'
        'Verificar mi cuenta</a></div>'
        '<div style="margin:30px 36px;text-align:center">'
        '<p style="font-size:12px;color:#999;line-height:1.5;margin:0 0 6px">Si el botón de arriba '
        'no te direcciona a la web, copiá y pegá este link en tu navegador:</p>'
        '<p style="font-size:12px;word-break:break-all;margin:0">'
        '<a href="{verify_url}" style="color:#999;text-decoration:underline">{verify_url}</a></p>'
        '</div>')

# Bloque de cierre común: marketplace + contacto + firma.
_TAIL = ('<p>Si aún no lo hiciste, podés elegir tu modelo de casa en nuestro marketplace '
         '<a href="https://construirfacil.com" style="color:#ff003d">construirfacil.com</a> y '
         'tener todo listo para iniciar los trámites del crédito y la compra.</p>'
         '<p>Por cualquier consulta o inconveniente también podés escribirnos a '
         '<a href="mailto:hola@construirfacil.com" style="color:#ff003d">hola@construirfacil.com</a> '
         'o por <a href="https://wa.me/5491166440000" style="color:#ff003d">WhatsApp</a>.</p>'
         '<p>Quedo atento.<br>Un saludo cordial,<br><strong>Construir Fácil</strong></p>')

# Footer reusado de los mails testeados: logo + disclaimer + baja one-click.
_WRAP = ('<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;'
         'color:#1a1a1a;line-height:1.6;max-width:560px">{body}'
         '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #ececec;'
         'text-align:center">'
         '<img src="https://www.construirfacil.com/cf_logo_gris.png" alt="Construir Fácil" '
         'width="150" style="max-width:150px;height:auto">'
         '<p style="margin-top:14px;font-size:11px;color:#9a9a9a;line-height:1.5">'
         'Recibís este correo porque nos llegó un formulario con tus datos y tu autorización para '
         'contactarte desde Construir Fácil. Si no querés seguir recibiendo correos, '
         '<a href="{unsub_url}" style="color:#9a9a9a;text-decoration:underline">date de baja acá</a>.'
         '</p></div></div>')

# Asunto único (doc SH), las dos variantes. {nombre} = primer nombre del lead.
_SUBJECT = "{nombre}, ¡Verificá tu registro en Construir Fácil y elegí tu nueva casa!"

TEMPLATES = {
    "READY": {
        "subject": _SUBJECT,
        "body": (
            "<p>Hola {nombre}, ¿cómo estás?</p>"
            "<p><strong>¡Tengo una excelente noticia para darte!</strong></p>"
            "<p>Evaluamos los datos de tu solicitud en <strong>Construir Fácil</strong> y tenés "
            "las dos condiciones que más pesan para avanzar en el trámite de compra de tu nueva "
            "casa:</p>"
            "<ul><li><strong>Buena capacidad de crédito según nuestra evaluación inicial</strong></li>"
            "<li><strong>Terreno apto donde construir la casa</strong></li></ul>"
            "<p><strong>Último paso para completar tu postulación:</strong></p>"
            "<p>Para confirmar tu registro y empezar a gestionar el trámite de reserva y seña de "
            "la casa que elegiste, pulsá el botón a continuación:</p>"
            + _BTN +
            "<p style=\"font-size:18px;margin:36px 0 12px\"><strong>ELEGÍ el modelo de casa "
            "que responda a tu necesidad.</strong></p>"
            + _TAIL
        ),
    },
    "QUALIFIES_LATER": {
        "subject": _SUBJECT,
        "body": (
            "<p>Hola {nombre}, ¿cómo estás?</p>"
            "<p><strong>¡Tengo una excelente noticia para darte!</strong></p>"
            "<p>Evaluamos los datos de tu solicitud en <strong>Construir Fácil</strong> y quiero "
            "contarte que el análisis de crédito dio muy bien y eso es un gran paso. "
            "<strong>Ahora nos falta lograr la tierra para tu nueva casa:</strong></p>"
            "<ul>"
            "<li>Estamos trabajando para generar <strong>lotes en varias localidades de "
            "Neuquén</strong>, junto a autoridades y gremios locales.</li>"
            "<li>Si ya diste el ok para gestionar tu tierra, serás de los primeros en enterarte "
            "cuando eso pase.</li>"
            "<li>Si no diste esa autorización, respondé este correo diciéndonos que te interesa "
            "un lote.</li>"
            "</ul>"
            "<p><strong>Último paso para completar tu postulación:</strong></p>"
            "<p>Para confirmar tu registro y empezar a gestionar el trámite de reserva y seña de "
            "la casa que elegiste, pulsá el botón a continuación:</p>"
            + _BTN +
            "<p style=\"font-size:18px;margin:36px 0 12px\"><strong>ELEGÍ el modelo de casa "
            "ideal, el que responda a tu gusto y necesidad.</strong></p>"
            + _TAIL
        ),
    },
}
ALLOWED_BUCKETS = ("READY", "QUALIFIES_LATER")


def load_envs():
    env = {}
    for fn in (".env", ".env.local"):
        p = CF / fn
        if p.exists():
            for line in p.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "RESEND_API_KEY",
              "RESEND_FROM_EMAIL", "HUBSPOT_TOKEN"):
        if not env.get(k):
            sys.exit(f"Falta {k} en .env/.env.local")
    return env


# ── Unsubscribe token: MISMO HMAC que lib/auth/unsubscribe-token.ts ──
def _unsub_secret(env):
    s = (env.get("CF_GATE_SECRET") or env.get("SUPABASE_SERVICE_ROLE_KEY")
         or env.get("SUPABASE_SERVICE_KEY") or "")
    if not s:
        sys.exit("Falta el secret de unsubscribe (CF_GATE_SECRET / SUPABASE_SERVICE_ROLE_KEY)")
    return s


def unsub_url(env, lead_id):
    sig = hmac.new(_unsub_secret(env).encode(), f"unsubscribe:{lead_id}".encode(),
                   hashlib.sha256).hexdigest()[:32]
    return f"{UNSUB_BASE}{lead_id}.{sig}"


def verify_url(env, lead_id):
    # MISMO HMAC que lib/auth/verify-token.ts (dominio 'verify', mismo secret).
    sig = hmac.new(_unsub_secret(env).encode(), f"verify:{lead_id}".encode(),
                   hashlib.sha256).hexdigest()[:32]
    return f"{VERIFY_BASE}{lead_id}.{sig}"


def http(url, headers, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    # Cloudflare (delante de Resend) bloquea el UA de python-urllib con error 1010.
    headers = {"User-Agent": "Mozilla/5.0", **headers}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def select_targets(env, bucket_filter):
    sel = "id,name,email,bucket,dni"
    flt = ("source=eq.sindicato_uocra&consent_captured_at=not.is.null"
           "&email=not.is.null&engagement_sent_at=is.null&unsubscribed=is.false")
    if bucket_filter:
        flt += f"&bucket=eq.{bucket_filter}"
    else:
        flt += "&bucket=in.(READY,QUALIFIES_LATER)"
    url = f"{env['SUPABASE_URL']}/rest/v1/leads?select={sel}&{flt}"
    h = {"apikey": env["SUPABASE_SERVICE_KEY"],
         "Authorization": f"Bearer {env['SUPABASE_SERVICE_KEY']}"}
    st, rows = http(url, h)
    if st != 200:
        sys.exit(f"SELECT falló ({st}): {rows}")
    return [r for r in rows if r.get("bucket") in ALLOWED_BUCKETS]


def render(tpl, nombre, verify_link, unsubscribe_url):
    subj = tpl["subject"].format(nombre=nombre)
    body = tpl["body"].format(nombre=nombre, verify_url=verify_link)
    html = _WRAP.format(body=body, unsub_url=unsubscribe_url)
    return subj, html


def send_resend(env, to_email, subject, html, unsubscribe_url):
    h = {"Authorization": f"Bearer {env['RESEND_API_KEY']}", "Content-Type": "application/json"}
    body = {"from": env["RESEND_FROM_EMAIL"], "to": [to_email], "subject": subject, "html": html,
            # reply-to a hola@construirfacil.com (buzón propio ya operativo). El "respondé este
            # mail confirmando" del CTA cae acá → es la confirmación/segundo opt-in del lead.
            "reply_to": "hola@construirfacil.com",
            "headers": {
                # One-click (RFC 8058): el botón nativo de Gmail hace POST a la URL → baja automática.
                "List-Unsubscribe": f"<{unsubscribe_url}>, <mailto:hola@construirfacil.com?subject=BAJA>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }}
    st, resp = http("https://api.resend.com/emails", h, "POST", body)
    return st in (200, 201), (resp if st not in (200, 201) else None)


def mark_sent(env, lead_id):
    h = {"apikey": env["SUPABASE_SERVICE_KEY"],
         "Authorization": f"Bearer {env['SUPABASE_SERVICE_KEY']}",
         "Content-Type": "application/json", "Prefer": "return=minimal"}
    from datetime import datetime, timezone
    url = f"{env['SUPABASE_URL']}/rest/v1/leads?id=eq.{lead_id}"
    st, _ = http(url, h, "PATCH",
                 {"engagement_sent_at": datetime.now(timezone.utc).isoformat(),
                  "engagement_channel": "email"})
    return st in (200, 204)


def log_hubspot(env, dni):
    """Best-effort: setea last_touch_at en el contacto. No bloquea el envío."""
    if not dni:
        return
    h = {"Authorization": f"Bearer {env['HUBSPOT_TOKEN']}", "Content-Type": "application/json"}
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    body = {"properties": {"last_touch_at": today, "last_touch_channel": "email"}}
    http(f"https://api.hubapi.com/crm/v3/objects/contacts/{dni}?idProperty=dni",
         h, "PATCH", body)  # ignoramos el resultado a propósito (best-effort)


def mask(s, keep=4):
    s = "" if s is None else str(s)
    return ("*" * max(0, len(s) - keep)) + s[-keep:] if s else "(vacío)"


def run_test(env, recipients, sample="Hola"):
    """Muestra de CADA bucket a direcciones de prueba. Formato por destinatario:
    'email' o 'email|Nombre' (para previsualizar el saludo personalizado). No toca la DB.
    En PRODUCCIÓN cada lead recibe SU propio nombre (no este sample)."""
    zero = "00000000-0000-0000-0000-000000000000"
    test_url = unsub_url(env, zero)
    test_verify = verify_url(env, zero)
    print(f"=== ENVÍO DE PRUEBA (muestra de cada bucket, nombre real por destinatario) ===")
    for bucket in ("READY", "QUALIFIES_LATER"):
        for spec in recipients:
            to, _, nm = spec.partition("|")
            nombre = nm or sample
            subj, html = render(TEMPLATES[bucket], nombre, test_verify, test_url)
            ok, err = send_resend(env, to, subj, html, test_url)
            print(f"  {bucket:16s} -> {to} (Hola {nombre}): {'OK' if ok else 'FALLÓ ' + str(err)}")
    print("\n(Prueba: nada se escribió en la base. En PRODUCCIÓN cada lead recibe SU propio nombre.)")


def main():
    commit = "--commit" in sys.argv
    bf = None
    if "--bucket" in sys.argv:
        bf = sys.argv[sys.argv.index("--bucket") + 1]
    env = load_envs()
    if "--test" in sys.argv:
        run_test(env, sys.argv[sys.argv.index("--test") + 1].split(","))
        return
    rows = select_targets(env, bf)

    from collections import Counter
    by_bucket = Counter(r["bucket"] for r in rows)
    print(f"\n=== ENGAGEMENT mail-first (modo: {'COMMIT' if commit else 'DRY-RUN'}) ===")
    print(f"From: {env['RESEND_FROM_EMAIL']}")
    print(f"Destinatarios (consentidos, con email, sin touch, sin baja): {len(rows)}")
    print(f"  por bucket: {dict(by_bucket)}")
    print("\nMuestra (PII enmascarada, copy renderizado):")
    for r in rows[:2]:
        nombre = (r.get("name") or "").split()[0] if r.get("name") else "Hola"
        subj, _ = render(TEMPLATES[r["bucket"]], nombre, verify_url(env, r["id"]), unsub_url(env, r["id"]))
        print(f"  -> {mask(r.get('email'),6)} [{r['bucket']}] asunto: «{subj}»")

    if not commit:
        print("\n[DRY-RUN] No se envió nada. Corré con --commit para enviar.")
        return

    sent = fail = 0
    for r in rows:
        nombre = (r.get("name") or "").split()[0] if r.get("name") else "Hola"
        uurl = unsub_url(env, r["id"])
        vurl = verify_url(env, r["id"])
        subj, html = render(TEMPLATES[r["bucket"]], nombre, vurl, uurl)
        ok, err = send_resend(env, r["email"], subj, html, uurl)
        if ok and mark_sent(env, r["id"]):
            log_hubspot(env, r.get("dni"))
            sent += 1
        else:
            fail += 1
            print(f"  FALLÓ {mask(r.get('email'),6)}: {err}")
        time.sleep(0.6)  # respeto rate-limit de Resend
    print(f"\n✓ Enviados: {sent} | Fallidos: {fail}")


if __name__ == "__main__":
    main()

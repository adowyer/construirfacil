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

# ════════════════════════════════════════════════════════════════════════
#  TEMPLATES — copy final aprobado. {nombre} = primer nombre del lead.
#  El footer (logo + disclaimer + baja one-click) lo agrega _WRAP en render().
# ════════════════════════════════════════════════════════════════════════
_WRAP = ('<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;'
         'color:#1a1a1a;line-height:1.6;max-width:560px">{body}'
         '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #ececec;'
         'text-align:center">'
         '<img src="https://www.construirfacil.com/cf_logo_gris.png" alt="Construir Fácil" '
         'width="150" style="max-width:150px;height:auto">'
         '<p style="margin-top:14px;font-size:11px;color:#9a9a9a;line-height:1.5">'
         'Recibís este correo porque nos llegó un formulario con tus datos y tu autorización para '
         'contactarte desde Construir Fácil. Al responder este mail confirmás tu registración. '
         'Si no querés seguir recibiendo correos, '
         '<a href="{unsub_url}" style="color:#9a9a9a;text-decoration:underline">date de baja acá</a>.'
         '</p></div></div>')

TEMPLATES = {
    "READY": {
        "subject": "{nombre}, tenemos excelentes noticias sobre tu casa",
        "body": (
            "<p>Hola {nombre}, ¿cómo estás?</p>"
            "<p>Evaluamos los datos de tu solicitud en <strong>Construir Fácil</strong> y "
            "<strong>¡tengo una excelente noticia para darte!</strong></p>"
            "<p>Tenés las dos condiciones que más pesan para acercarte a tu nueva casa:</p>"
            "<ul><li><strong>Capacidad de crédito pre aprobada</strong></li>"
            "<li><strong>Terreno apto dónde construir la casa</strong></li></ul>"
            "<p>Ahora falta <strong>elegir tu modelo de casa</strong> indicado, e iniciar los "
            "trámites. Nos gustaría convenir los próximos pasos en una breve llamada por whatsapp.</p>"
            "<p>¿Te queda mejor que te llamemos por la mañana o por la tarde en los próximos "
            "días? Si tenés un horario preferido, o un día en particular en que no puedas, por "
            "favor decímelo.</p>"
            "<p>Un asesor de Construir Fácil se pondrá en contacto en breve para avanzar.</p>"
            "<p>Quedo atento.<br>Un saludo cordial,<br><strong>Construir Fácil</strong></p>"
        ),
    },
    "QUALIFIES_LATER": {
        "subject": "{nombre}, avanzamos con tu casa, ¿buscamos un lote?",
        "body": (
            "<p>Hola {nombre}, ¿cómo estás?</p>"
            "<p>Evaluamos los datos de tu solicitud en <strong>Construir Fácil</strong> y quiero "
            "contarte que <strong>el análisis de crédito dio muy bien</strong> y eso es un gran "
            "paso. Lo que falta ahora es lograr la tierra para tu nueva casa.</p>"
            "<p>Estamos trabajando para generar <strong>lotes en varias localidades de "
            "Neuquén</strong>, junto a autoridades y gremios locales, y si ya diste el ok para "
            "gestionar tu tierra serás de los primeros en enterarte cuando eso pase.</p>"
            "<p>Podemos ganar tiempo ayudándote a <strong>elegir tu modelo de casa</strong> "
            "indicado, e iniciar los trámites. Nos gustaría convenir los próximos pasos en una "
            "breve llamada por whatsapp.</p>"
            "<p>¿Te queda mejor que te llamemos por la mañana o por la tarde en los próximos "
            "días? Si tenés un horario preferido, o un día en particular en que no puedas, por "
            "favor decímelo.</p>"
            "<p>Un asesor de Construir Fácil se pondrá en contacto en breve para avanzar.</p>"
            "<p>Quedo atento.<br>Un saludo cordial,<br><strong>Construir Fácil</strong></p>"
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


def render(tpl, nombre, unsubscribe_url):
    subj = tpl["subject"].format(nombre=nombre)
    html = _WRAP.format(body=tpl["body"].format(nombre=nombre), unsub_url=unsubscribe_url)
    return subj, html


def send_resend(env, to_email, subject, html, unsubscribe_url):
    h = {"Authorization": f"Bearer {env['RESEND_API_KEY']}", "Content-Type": "application/json"}
    body = {"from": env["RESEND_FROM_EMAIL"], "to": [to_email], "subject": subject, "html": html,
            # reply-to a hola@ximia.ai (construirfacil.com no tiene MX → rebotaría). ximia.ai sí recibe.
            "reply_to": "hola@ximia.ai",
            "headers": {
                # One-click (RFC 8058): el botón nativo de Gmail hace POST a la URL → baja automática.
                "List-Unsubscribe": f"<{unsubscribe_url}>, <mailto:hola@ximia.ai?subject=BAJA>",
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


def run_test(env, recipients, sample="Andrea"):
    """Muestra de CADA bucket a direcciones de prueba. No toca la DB. El link de
    baja usa un token dummy (al clickear dirá 'no pudimos procesar' — es prueba)."""
    test_url = unsub_url(env, "00000000-0000-0000-0000-000000000000")
    print(f"=== ENVÍO DE PRUEBA a {recipients} (muestra de cada bucket, nombre='{sample}') ===")
    for bucket in ("READY", "QUALIFIES_LATER"):
        subj, html = render(TEMPLATES[bucket], sample, test_url)
        for to in recipients:
            ok, err = send_resend(env, to, subj, html, test_url)
            print(f"  {bucket:16s} -> {to}: {'OK' if ok else 'FALLÓ ' + str(err)}")
    print("\n(Prueba: nada se escribió en la base. Revisá cómo llegan los 2 mails.)")


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
        subj, _ = render(TEMPLATES[r["bucket"]], nombre, unsub_url(env, r["id"]))
        print(f"  -> {mask(r.get('email'),6)} [{r['bucket']}] asunto: «{subj}»")

    if not commit:
        print("\n[DRY-RUN] No se envió nada. Corré con --commit para enviar.")
        return

    sent = fail = 0
    for r in rows:
        nombre = (r.get("name") or "").split()[0] if r.get("name") else "Hola"
        uurl = unsub_url(env, r["id"])
        subj, html = render(TEMPLATES[r["bucket"]], nombre, uurl)
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

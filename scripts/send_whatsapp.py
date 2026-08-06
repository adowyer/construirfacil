#!/usr/bin/env python3
"""
send_whatsapp.py — envío de la plantilla de confirmación por WhatsApp Cloud API.

Hermano de send_engagement.py (mail). Mismas garantías, otro canal.

USO
    python3 scripts/send_whatsapp.py                 # dry-run: muestra a quién le iría
    python3 scripts/send_whatsapp.py --test 5491131551775
    python3 scripts/send_whatsapp.py --commit        # envío real
    python3 scripts/send_whatsapp.py --commit --limit 50

GARANTÍAS (en código, no en la cabeza del que lo corre)
  - Solo leads CONSENTIDOS (`consent_captured_at not null`). Ley 25.326 + el opt-in
    que exige Meta. El texto de la ficha nombra a construirfacil.com Y a WhatsApp.
  - Excluye `unsubscribed`. Nunca se le vuelve a escribir a quien pidió la baja.
  - Idempotente por `whatsapp_sent_at`: correrlo dos veces no manda dos veces.
  - TOPE POR TIER: el número está en TIER_250 → 250 personas nuevas cada 24 h.
    El script corta ahí y dice cuántos quedaron. Descubrir el límite a mitad de la
    tanda es peor que respetarlo desde el principio.
  - El token del link se firma con el MISMO HMAC que lib/auth/verify-token.ts y que
    send_engagement.py (dominio 'verify'). No hay una segunda implementación.
  - Al final NO reporta contra la respuesta de Meta: lee `whatsapp_events`. Un 200 de
    Meta significa ACEPTADO, no ENTREGADO.

⚠️ La plantilla tiene que estar APPROVED y en categoría UTILITY. Si está en MARKETING,
   el script se niega a mandar: el consentimiento autoriza contacto "para evaluar el
   acceso a financiación de vivienda", no publicidad — mandar Marketing a esta lista
   excede lo que la gente firmó.
"""
import argparse, hashlib, hmac, json, re, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

CF = Path(__file__).resolve().parent.parent

TEMPLATE = "confirmacion_registro"
LANG = "es_AR"
TIER_CAP = 250                      # TIER_250 — subir sólo cuando Meta suba el tier
GRAPH = "https://graph.facebook.com/v23.0"
VERIFY_BASE = "https://www.construirfacil.com/verify?c=wa&u="
PACE_SECONDS = 1.0                  # sin apuro: un número nuevo que dispara rápido
                                    # se gana un quality rating malo


# ── env ────────────────────────────────────────────────────────────────────
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
    faltan = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY",
                          "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
                          "WHATSAPP_WABA_ID") if not env.get(k)]
    if faltan:
        sys.exit("Falta en .env/.env.local: " + ", ".join(faltan))
    return env


def http(url, headers, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"User-Agent": "Mozilla/5.0", **headers}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def sb_headers(env, write=False):
    h = {"apikey": env["SUPABASE_SERVICE_KEY"],
         "Authorization": f"Bearer {env['SUPABASE_SERVICE_KEY']}"}
    if write:
        h["Content-Type"] = "application/json"
        h["Prefer"] = "return=minimal"
    return h


# ── token del link: MISMO HMAC que lib/auth/verify-token.ts ────────────────
def verify_token(env, lead_id):
    secret = (env.get("CF_GATE_SECRET") or env.get("SUPABASE_SERVICE_ROLE_KEY")
              or env.get("SUPABASE_SERVICE_KEY") or "")
    if not secret:
        sys.exit("Falta CF_GATE_SECRET / SUPABASE_SERVICE_ROLE_KEY para firmar el link")
    sig = hmac.new(secret.encode(), f"verify:{lead_id}".encode(),
                   hashlib.sha256).hexdigest()[:32]
    return f"{lead_id}.{sig}"


# ── nombre limpio para {{1}} ───────────────────────────────────────────────
def first_name(raw):
    """
    Los nombres vienen del OCR de fichas manuscritas: en MAYÚSCULAS y a veces con
    el apellido pegado. "Hola MARGARITA MATTO GRISELDA," se lee como spam.
    """
    if not raw:
        return None
    tok = re.split(r"[\s,]+", raw.strip())
    tok = [t for t in tok if t]
    if not tok:
        return None
    n = tok[0]
    return n.capitalize() if (n.isupper() or n.islower()) else n


# ── destinatarios ──────────────────────────────────────────────────────────
FIELDS = ("id,name,phone,source,consent_captured_at,unsubscribed,"
          "whatsapp_sent_at,engagement_sent_at,email_verified_at,synced_hubspot_id")


def select_targets(env, source):
    flt = ("consent_captured_at=not.is.null"
           "&phone=not.is.null"
           "&unsubscribed=is.false"
           "&whatsapp_sent_at=is.null"
           "&email_verified_at=is.null")   # el que ya confirmó no necesita el aviso
    if source:
        flt += f"&source=eq.{source}"
    url = f"{env['SUPABASE_URL']}/rest/v1/leads?select={FIELDS}&{flt}&order=id"
    st, rows = http(url, sb_headers(env))
    if st != 200:
        sys.exit(f"SELECT falló ({st}): {rows}")
    return rows


# ── candado: la plantilla tiene que estar aprobada Y ser UTILITY ───────────
def check_template(env):
    url = (f"{GRAPH}/{env['WHATSAPP_WABA_ID']}/message_templates"
           f"?fields=name,status,category&access_token={env['WHATSAPP_TOKEN']}")
    st, body = http(url, {})
    if st != 200:
        sys.exit(f"No se pudo leer el estado de las plantillas ({st}): {body}")
    for t in body.get("data", []):
        if t.get("name") == TEMPLATE:
            return t
    sys.exit(f"La plantilla '{TEMPLATE}' no existe en la WABA.")


def guard_template(tpl, commit):
    print(f"Plantilla '{TEMPLATE}': status={tpl['status']} categoría={tpl['category']}")
    if tpl["status"] != "APPROVED":
        msg = f"⛔ La plantilla está en {tpl['status']}, no se puede enviar."
        sys.exit(msg) if commit else print(msg + "  (dry-run sigue igual)")
    if tpl["category"] != "UTILITY":
        msg = (f"⛔ La plantilla quedó en categoría {tpl['category']}.\n"
               "   El consentimiento autoriza contacto PARA EVALUAR FINANCIACIÓN,\n"
               "   no publicidad. Mandar Marketing a esta lista excede lo firmado.\n"
               "   Apelar la categorización o reescribir la plantilla.")
        sys.exit(msg) if commit else print(msg + "\n   (dry-run sigue igual)")


# ── candado: contrastar el lote contra HubSpot antes de mandar ────────────
NO_CONTACTAR = "No volver a contactar"


def guard_hubspot(env, lote, commit):
    """
    Dos cosas que sólo sabe HubSpot y que hay que mirar ANTES de mandar.

    1. EL TELÉFONO. HubSpot es su dueño (ownership acordado: las asesoras lo
    corrigen ahí, llamando, y esa es la info viva). Supabase lo recibe por el
    pull de `sync_hubspot_to_supabase.py`.

    Ese pull estuvo MUDO del 2026-07-20 al 2026-08-05: un guard salteaba SIEMPRE
    la columna `phone` y no contaba lo que salteaba, así que 49 correcciones
    humanas nunca bajaron y nadie lo vio. El sync está arreglado, pero el que
    corra este script no tiene por qué acordarse de haberlo corrido — y un envío
    a un número viejo no se puede deshacer.

    Por eso no chequeamos "¿corrió el sync?" (un proxy) sino el hecho: para los
    leads de ESTE lote, ¿el teléfono de Supabase es el mismo que el de HubSpot?
    Se comparan normalizados, así que un formato distinto no cuenta como
    discrepancia — sólo un número distinto.

    2. QUIÉN PIDIÓ NO SER CONTACTADO. `estado_del_contacto` lo cargan las
    asesoras al llamar, y "No volver a contactar" es lo que dijo la persona.
    No vive en Supabase, así que el filtro de elegibles no lo ve: el 2026-08-05
    había 11 de esos adentro del lote. La exclusión NO es opcional ni depende de
    --commit; `unsubscribed` cubre a quien contestó BAJA, esto cubre a quien lo
    dijo por teléfono, y son la misma voluntad por dos canales distintos.

    El resto de los estados SÍ recibe. En particular los 129 de "Primer Contacto
    - Datos verificados": la asesora ya les avisó que les iba a llegar un link
    para verificar, así que son los que más lo esperan. Lo mismo los que tienen
    la reserva en curso — de los 23, 22 son de ese grupo.
    """
    con_id = [r for r in lote if r.get("synced_hubspot_id")]
    if not con_id:
        print("⚠️ Ningún lead del lote tiene synced_hubspot_id — no se puede "
              "contrastar contra HubSpot. Corré el sync antes de mandar.")
        if commit:
            sys.exit(1)
        return lote

    tok = env.get("HUBSPOT_TOKEN")
    if not tok:
        msg = "⛔ Falta HUBSPOT_TOKEN: no se puede verificar el teléfono contra HubSpot."
        sys.exit(msg) if commit else print(msg + "  (dry-run sigue)")
        return lote

    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    hs = {}
    for i in range(0, len(con_id), 100):
        chunk = con_id[i:i + 100]
        st, body = http("https://api.hubapi.com/crm/v3/objects/contacts/batch/read",
                        h, "POST",
                        {"properties": ["phone", "estado_del_contacto"],
                         "inputs": [{"id": str(r["synced_hubspot_id"])} for r in chunk]})
        if st != 200:
            msg = f"⛔ No se pudo leer HubSpot ({st}): {json.dumps(body, ensure_ascii=False)[:200]}"
            sys.exit(msg) if commit else print(msg + "  (dry-run sigue)")
            return lote
        for c in body.get("results", []):
            hs[c["id"]] = c.get("properties") or {}

    # --- 2. los que pidieron no ser contactados salen SIEMPRE ---
    vetados = [r for r in con_id
               if (hs.get(str(r["synced_hubspot_id"])) or {}).get("estado_del_contacto") == NO_CONTACTAR]
    if vetados:
        print(f"🛑 {len(vetados)} marcados '{NO_CONTACTAR}' en HubSpot — se excluyen:")
        for r in vetados[:5]:
            print(f"    {(r.get('name') or '')[:34]}")
        if len(vetados) > 5:
            print(f"    … y {len(vetados) - 5} más")
        ids = {r["id"] for r in vetados}
        lote = [r for r in lote if r["id"] not in ids]
        con_id = [r for r in con_id if r["id"] not in ids]

    sin_ficha = len([r for r in lote if not r.get("synced_hubspot_id")])
    if sin_ficha:
        print(f"⚠️ {sin_ficha} sin contacto en HubSpot: no se les pudo verificar "
              f"ni el teléfono ni el estado.")

    # --- 1. el teléfono de Supabase contra el de HubSpot ---
    desfasados = []
    for r in con_id:
        h_tel = (hs.get(str(r["synced_hubspot_id"])) or {}).get("phone")
        if not h_tel:
            continue                      # sin teléfono en HubSpot: no contradice nada
        if wa_number(h_tel) != wa_number(r.get("phone")):
            desfasados.append((r, h_tel))

    if not desfasados:
        print(f"✓ Teléfonos al día: los {len(con_id)} del lote coinciden con HubSpot.")
        return lote

    print(f"\n⛔ {len(desfasados)} teléfonos de Supabase NO coinciden con HubSpot.")
    print("   HubSpot manda: son correcciones de las asesoras que todavía no bajaron.")
    for r, h_tel in desfasados[:10]:
        print(f"    {(r.get('name') or '')[:28]:<30} supabase={r.get('phone')!r:<18} hubspot={h_tel!r}")
    if len(desfasados) > 10:
        print(f"    … y {len(desfasados) - 10} más")
    print("\n   Bajalos primero:  python3 scripts/sync_hubspot_to_supabase.py --write")
    if commit:
        sys.exit(1)
    print("   (dry-run: se excluyen del lote para que el conteo no mienta)")
    ids = {r["id"] for r, _ in desfasados}
    return [r for r in lote if r["id"] not in ids]


# ── envío ──────────────────────────────────────────────────────────────────
def send_template(env, to_phone, nombre, token):
    url = f"{GRAPH}/{env['WHATSAPP_PHONE_NUMBER_ID']}/messages"
    h = {"Authorization": f"Bearer {env['WHATSAPP_TOKEN']}",
         "Content-Type": "application/json"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": TEMPLATE,
            "language": {"code": LANG},
            "components": [
                {"type": "body",
                 "parameters": [{"type": "text", "text": nombre}]},
                {"type": "button", "sub_type": "url", "index": "0",
                 "parameters": [{"type": "text", "text": token}]},
            ],
        },
    }
    return http(url, h, "POST", payload)


def wa_number(phone):
    """
    Normaliza un teléfono argentino al formato que quiere WhatsApp: 549 + 10 dígitos.

    La base trae de todo: con y sin 0, con y sin 15, con y sin código de país, con
    guiones, y algún DNI cargado en el campo equivocado.

    ⚠️ EL ANCLA ES LA LONGITUD, NO EL PATRÓN "15".
    La versión anterior buscaba "15" después del código de área y lo borraba. Eso
    rompía todo número que tuviera un "15" ADENTRO: 11-3155-1775 quedaba mutilado
    porque "3155" contiene "15". Chequear la palabra en vez del constructo.
    El número nacional argentino (área + abonado) SIEMPRE tiene 10 dígitos, así que
    sólo se saca el 15 cuando sobran exactamente 2 dígitos.
    """
    d = re.sub(r"\D", "", phone or "")
    if not d:
        return None
    if d.startswith("54"):          # código de país
        d = d[2:]
    if d.startswith("9"):           # marcador de móvil (lo volvemos a poner al final)
        d = d[1:]
    d = d.lstrip("0")               # prefijo de larga distancia

    if len(d) == 12:                # sobran 2 → hay un 15 después del área
        for pref in (2, 3, 4):      # códigos de área argentinos: 2, 3 o 4 dígitos
            if d[pref:pref + 2] == "15":
                d = d[:pref] + d[pref + 2:]
                break

    if len(d) != 10:                # exigente a propósito: mejor saltear y avisar
        return None                 # que mandarle a un número inventado
    return "549" + d


def mark_sent(env, lead, ahora):
    patch = {"whatsapp_sent_at": ahora}
    # engagement_sent_at = PRIMER touch comercial. Solo si todavía no hubo ninguno.
    if not lead.get("engagement_sent_at"):
        patch["engagement_sent_at"] = ahora
        patch["engagement_channel"] = "whatsapp"
    url = f"{env['SUPABASE_URL']}/rest/v1/leads?id=eq.{lead['id']}"
    st, _ = http(url, sb_headers(env, write=True), "PATCH", patch)
    return st in (200, 204)


# ── reporte: contra el ledger, no contra la respuesta de Meta ─────────────
def report(env, desde_iso):
    url = (f"{env['SUPABASE_URL']}/rest/v1/whatsapp_events"
           f"?select=kind,status&occurred_at=gte.{desde_iso}")
    st, rows = http(url, sb_headers(env))
    if st != 200:
        print(f"⚠️ No se pudo leer el ledger ({st}): {rows}")
        return
    c = {}
    for r in rows or []:
        k = r["status"] if r["kind"] == "status" else "entrante"
        c[k] = c.get(k, 0) + 1
    print("\n── Según whatsapp_events (la verdad, no el 200 de Meta) ──")
    if not c:
        print("  (todavía sin eventos — los estados tardan unos segundos)")
    for k in ("sent", "delivered", "read", "failed", "entrante"):
        if k in c:
            print(f"  {k:10} {c[k]}")


# ── main ───────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="envío real")
    ap.add_argument("--test", metavar="TELEFONO", help="mandar sólo a este número")
    ap.add_argument("--limit", type=int, default=TIER_CAP)
    ap.add_argument("--source", default="sindicato_uocra")
    args = ap.parse_args()

    env = load_envs()
    tpl = check_template(env)
    guard_template(tpl, args.commit)

    if args.test:
        to = wa_number(args.test)
        if not to:
            sys.exit(f"Teléfono inválido: {args.test}")
        if not args.commit:
            print(f"[dry-run] mandaría '{TEMPLATE}' a {to}")
            return
        st, body = send_template(env, to, "Andrea", verify_token(env, "00000000-0000-0000-0000-000000000000"))
        print(f"HTTP {st}: {json.dumps(body, ensure_ascii=False)}")
        return

    rows = select_targets(env, args.source)
    cap = min(args.limit, TIER_CAP)
    print(f"Elegibles (consentidos, con teléfono, sin baja, sin WhatsApp previo, "
          f"sin verificar): {len(rows)}")
    if len(rows) > cap:
        print(f"⚠️ TIER_250: se mandan {cap} y quedan {len(rows) - cap} "
              f"para la próxima corrida (dentro de 24 h).")
    lote = rows[:cap]

    sin_tel = [r for r in lote if not wa_number(r.get("phone"))]
    if sin_tel:
        print(f"⚠️ {len(sin_tel)} con teléfono no interpretable — se saltean:")
        for r in sin_tel[:5]:
            print(f"    {r['id']}  {r.get('phone')!r}")

    lote = [r for r in lote if wa_number(r.get("phone"))]
    lote = guard_hubspot(env, lote, args.commit)

    if not args.commit:
        print(f"\n[dry-run] se mandaría a {len(lote)}. Muestra:")
        for r in lote[:5]:
            print(f"  {first_name(r.get('name')):15} {wa_number(r['phone'])}")
        print("\nPara mandar de verdad: --commit")
        return

    desde = datetime.now(timezone.utc).isoformat()
    ok = fail = 0
    for i, r in enumerate(lote, 1):
        nombre = first_name(r.get("name")) or "Hola"
        st, body = send_template(env, wa_number(r["phone"]), nombre,
                                 verify_token(env, r["id"]))
        if st == 200:
            ok += 1
            if not mark_sent(env, r, datetime.now(timezone.utc).isoformat()):
                print(f"  ⚠️ {r['id']}: se mandó pero NO se pudo marcar — "
                      f"revisar antes de re-correr, o se le manda dos veces")
        else:
            fail += 1
            print(f"  ✗ {r['id']} ({r.get('phone')}): {st} {json.dumps(body, ensure_ascii=False)[:200]}")
        if i % 25 == 0:
            print(f"  … {i}/{len(lote)}")
        time.sleep(PACE_SECONDS)

    print(f"\nAceptados por Meta: {ok}   Rechazados: {fail}")
    print("Esperando 20s a que lleguen los estados…")
    time.sleep(20)
    report(env, desde)


if __name__ == "__main__":
    main()

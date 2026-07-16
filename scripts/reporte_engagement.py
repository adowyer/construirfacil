#!/usr/bin/env python3
"""
reporte_engagement.py — reporte de verificación de la tanda de engagement UOCRA.

Muestra, para los leads a los que YA se les envió el mail (engagement_sent_at):
  · quiénes VERIFICARON (clic real en /verify → email_verified_at) con fecha y teléfono
  · quiénes NO verificaron todavía (ordenados por crédito = orden sugerido de llamado)
  · bajas (unsubscribed)
  · recordatorio de los sin-mail (pendientes de WhatsApp manual)

READ-ONLY: no escribe nada. Señal server-side (el clic en el link firmado), NO depende
de píxeles de apertura. "No verificó" ≠ "no lo vio": verificar es la acción de más
fricción. Para apertura/clic-por-casa hace falta el tracking pendiente (HANDOFF
2026-07-14 §5.4).

Uso:
    python3 scripts/reporte_engagement.py            # la tanda con terreno (READY)
    python3 scripts/reporte_engagement.py --todos    # todos los que tengan envío, sin filtrar bucket

Creds: .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
"""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"


def load_env():
    e = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            e[k.strip()] = v.strip().strip("\"'")
    for k in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not e.get(k):
            sys.exit(f"Falta {k} en {ENV_FILE}")
    return e


def fetch(env, todos=False):
    flt = "" if todos else "&has_lot=is.true&bucket=eq.READY"
    url = (f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/leads"
           "?select=id,name,email,phone,localidad,monthly_income_ars,loan_usd,has_anticipo,"
           "engagement_sent_at,email_verified_at,unsubscribed,has_lot,bucket"
           f"&source=eq.sindicato_uocra{flt}&limit=1000")
    h = {"apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
         "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}"}
    with urllib.request.urlopen(urllib.request.Request(url, headers=h)) as r:
        return json.loads(r.read().decode())


def fetch_clicks(env):
    """Clics por lead desde lead_link_clicks (migración 0096). Si la tabla no existe
    todavía (migración sin correr), devuelve {} y el reporte sale igual."""
    url = (f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/lead_link_clicks"
           "?select=lead_id,model_slug,target,clicked_at&order=clicked_at.desc&limit=2000")
    h = {"apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
         "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h)) as r:
            rows = json.loads(r.read().decode())
    except Exception:
        return {}
    by = {}
    for c in rows:
        by.setdefault(c["lead_id"], []).append(c)
    return by


def resumen_clicks(clicks):
    """'Casa Lanín ×2 · marketplace' — qué tocó, compacto."""
    cnt = {}
    for c in clicks:
        k = c.get("model_slug") or ("marketplace" if c.get("target") == "/" else c.get("target"))
        cnt[k] = cnt.get(k, 0) + 1
    return " · ".join(f"{k}{'×' + str(n) if n > 1 else ''}" for k, n in cnt.items())


def hace(ts):
    """'hace 3h' / 'hace 2d' desde un timestamp ISO."""
    if not ts:
        return ""
    t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    d = datetime.now(timezone.utc) - t
    if d.days >= 1:
        return f"hace {d.days}d"
    return f"hace {d.seconds // 3600}h"


def main():
    todos = "--todos" in sys.argv
    env = load_env()
    rows = fetch(env, todos)

    enviados = [r for r in rows if r.get("engagement_sent_at")]
    sin_mail = [r for r in rows if not r.get("email")]
    clicks_by = fetch_clicks(env)
    ver = sorted([r for r in enviados if r.get("email_verified_at")],
                 key=lambda r: r["email_verified_at"], reverse=True)
    nover = sorted([r for r in enviados if not r.get("email_verified_at")],
                   key=lambda r: -(r.get("loan_usd") or 0))
    bajas = [r for r in enviados if r.get("unsubscribed")]

    ancho = 74
    print("═" * ancho)
    print(f"  ENGAGEMENT UOCRA — {'todos los buckets' if todos else 'tanda con terreno (READY)'}"
          f"   ·   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("═" * ancho)
    pct = (100 * len(ver) // len(enviados)) if enviados else 0
    print(f"  enviados {len(enviados)}   ·   ✅ verificaron {len(ver)} ({pct}%)"
          f"   ·   ⏳ sin verificar {len(nover)}   ·   🚫 bajas {len(bajas)}")

    if ver:
        print("\n  ✅ VERIFICARON — llamar primero (hicieron el clic, están calientes)")
        print("  " + "─" * (ancho - 2))
        for r in ver:
            ts = r["email_verified_at"][:16].replace("T", " ")
            ant = "CON anticipo" if r.get("has_anticipo") else "sin anticipo"
            print(f"   {ts} ({hace(r['email_verified_at']):8}) {r['name'][:26]:27}"
                  f" 📞 {str(r.get('phone')):12} USD {r.get('loan_usd') or 0:>7,} {ant}")
            cl = clicks_by.get(r.get("id"))
            if cl:
                print(f"        🏠 miró: {resumen_clicks(cl)}")

    if nover:
        print(f"\n  ⏳ SIN VERIFICAR — orden sugerido de llamado (por crédito)")
        print("  " + "─" * (ancho - 2))
        for i, r in enumerate(nover, 1):
            ant = "💰" if r.get("has_anticipo") else "  "
            cl = clicks_by.get(r.get("id"))
            extra = f"  🏠 {resumen_clicks(cl)}" if cl else ""
            print(f"   {i:2}. {r['name'][:27]:28} 📞 {str(r.get('phone')):12}"
                  f" USD {r.get('loan_usd') or 0:>7,} {ant}{extra}")

    if bajas:
        print("\n  🚫 BAJAS — NO contactar por mail")
        for r in bajas:
            print(f"   {r['name']}")

    if sin_mail and not todos:
        print(f"\n  📱 SIN MAIL — pendientes de WhatsApp manual ({len(sin_mail)})")
        for r in sin_mail:
            print(f"   {r['name'][:28]:29} 📞 {r.get('phone')}")

    print("\n  ⓘ  'No verificó' ≠ 'no lo vio' (verificar = abrir + clic). Rebotes: dashboard de Resend.")
    print("═" * ancho)


if __name__ == "__main__":
    main()

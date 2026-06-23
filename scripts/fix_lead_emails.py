#!/usr/bin/env python3
"""
fix_lead_emails.py — corrige emails inválidos en leads que rompen el upsert a
HubSpot (HubSpot rechaza el LOTE entero si un solo email es inválido).

Caso típico (OCR de forms manuscritos): el postulante escribió 'x@gmail' sin
'.com'. Fix: si el dominio (después de @) NO tiene punto, le agrega '.com'.
Cualquier otro inválido (dot raro, TLD inventado) se FLAGEA para revisión
manual — no se toca a ciegas.

DRY-RUN por defecto. --commit aplica los PATCH.
Creds: .env (SUPABASE_URL, SUPABASE_SERVICE_KEY). No imprime secretos.

Uso:
    python3 fix_lead_emails.py            # escanea + propone (no escribe)
    python3 fix_lead_emails.py --commit   # aplica los fixes inequívocos
"""
import json, re, sys, urllib.request, urllib.error
from pathlib import Path

CF = Path(__file__).resolve().parent.parent
VALID = re.compile(r'^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$')          # mismo que actions.ts
NO_TLD = re.compile(r'^[^\s@]+@[^.\s@]+$')                       # dominio sin punto -> +'.com'


def env():
    e = {}
    p = CF / ".env"
    for line in p.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1); e[k.strip()] = v.strip()
    return e


def http(url, headers, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode(); return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as ex:
        return ex.code, ex.read().decode()


def main():
    commit = "--commit" in sys.argv
    e = env()
    h = {"apikey": e["SUPABASE_SERVICE_KEY"], "Authorization": f"Bearer {e['SUPABASE_SERVICE_KEY']}"}
    st, rows = http(f"{e['SUPABASE_URL']}/rest/v1/leads?select=id,email,dni&email=not.is.null", h)
    if st != 200:
        sys.exit(f"SELECT falló ({st}): {rows}")

    fixable, manual = [], []
    for r in rows:
        em = (r.get("email") or "").strip()
        if VALID.match(em):
            continue
        if NO_TLD.match(em):
            fixable.append((r["id"], em, em + ".com"))
        else:
            manual.append((r["id"], em))

    print(f"\n=== EMAILS INVÁLIDOS (de {len(rows)} con email) — modo {'COMMIT' if commit else 'DRY-RUN'} ===")
    print(f"Auto-fixables (+.com): {len(fixable)} | Revisión manual: {len(manual)}")
    for _id, old, new in fixable:
        print(f"  fix:    {old}  ->  {new}")
    for _id, old in manual:
        print(f"  ⚠️ manual: {old}  (no se toca — revisalo vos)")

    if not commit:
        print("\n[DRY-RUN] Nada escrito. Corré con --commit para aplicar los +.com.")
        return

    ph = {**h, "Content-Type": "application/json", "Prefer": "return=minimal"}
    ok = 0
    for _id, old, new in fixable:
        st, _ = http(f"{e['SUPABASE_URL']}/rest/v1/leads?id=eq.{_id}", ph, "PATCH", {"email": new})
        if st in (200, 204): ok += 1
        else: print(f"  FALLÓ {old}: {st}")
    print(f"\n✓ Corregidos: {ok}/{len(fixable)}. Manuales pendientes: {len(manual)}.")


if __name__ == "__main__":
    main()

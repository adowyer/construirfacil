#!/usr/bin/env python3
"""CANDADO: la anon key NO puede leer datos personales (hallazgo X-00, 2026-08-01).

    python3 scripts/test_anon_exposure.py

POR QUÉ EXISTE
--------------
El 2026-08-01 se descubrió que `public.users` (374 filas con email, nombre y teléfono) era
legible con la **anon key** — la que viaja en el bundle de JavaScript del sitio. Cualquiera
que abriera las devtools de construirfacil.com podía bajarse la tabla entera de personas.
`public.leads` sí estaba protegida; el resto de las tablas del lado Ximia, no.

Lo arregla la migración `0104_revoke_anon_pii_y_esquema_private.sql`. Este script es el
candado: afirma contra la base VIVA que la fuga sigue cerrada. Si alguien vuelve a darle
`select` a `anon` sobre una de estas tablas, esto explota.

Es el mismo principio que `scripts/test_conformidad.sql`: una decisión sin assert es una
decisión sin candado. Un comentario en una migración no garantiza nada.

Sólo LEE. No escribe, no borra, no imprime datos personales — sólo cuenta filas.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Tablas que NUNCA deben ser legibles con la anon key.
FORBIDDEN = [
    "users",                          # 🔴 la que estaba abierta: email, name, phone de 374 personas
    "leads",                          # ya estaba cerrada — que siga así
    "conversations",                  # transcripciones de charlas con Ximia
    "messages",
    "lead_qualification",
    "property_matches",
    "financial_matrix",
    "private_financing_commitments",
    "form_rate_limits",               # verla permite mapear/eludir el anti-spam
    "system_config",                  # parámetros + secreto de firma
]

# El catálogo público SÍ tiene que ser legible: si esto se rompe, se rompe el sitio.
MUST_READ = ["house_catalog", "marcas"]


def env():
    out = {}
    for name in (".env.local", ".env"):
        p = ROOT / name
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out.setdefault(k, v.strip().strip('"').strip("'"))
    return out


def probe(url, key, table):
    """-> (legible: bool, detalle: str)"""
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?select=*&limit=1",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
            "Range": "0-0",
            "User-Agent": "Mozilla/5.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            n = r.headers.get("Content-Range", "?").split("/")[-1]
            return True, f"{n} filas expuestas"
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode()).get("message", "")
        except Exception:  # noqa: BLE001
            msg = ""
        return False, f"HTTP {e.code} {msg[:60]}"
    except Exception as e:  # noqa: BLE001
        return False, f"error de red: {e}"


def main():
    e = env()
    url = e.get("NEXT_PUBLIC_SUPABASE_URL")
    anon = e.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not anon:
        sys.exit("faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local")

    fails = 0
    print("Con la ANON KEY (la que está en el bundle público del sitio):\n")
    for t in FORBIDDEN:
        readable, detail = probe(url, anon, t)
        if readable:
            print(f"  FAIL  {t:32} LEGIBLE — {detail}")
            fails += 1
        else:
            print(f"  OK    {t:32} cerrada ({detail})")

    print()
    for t in MUST_READ:
        readable, detail = probe(url, anon, t)
        if readable:
            print(f"  OK    {t:32} legible como corresponde ({detail})")
        else:
            print(f"  FAIL  {t:32} SE ROMPIÓ el catálogo público — {detail}")
            fails += 1

    print(f"\n{'TODO CERRADO' if not fails else f'{fails} PROBLEMA(S)'}")
    sys.exit(0 if not fails else 1)


if __name__ == "__main__":
    main()

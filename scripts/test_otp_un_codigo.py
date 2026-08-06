#!/usr/bin/env python3
"""CANDADO — un solo código OTP vivo por mail.

    python3 scripts/test_otp_un_codigo.py           # estructura del código (sin red)
    python3 scripts/test_otp_un_codigo.py --live    # + contra la base: índice e invariante

POR QUÉ EXISTE
--------------
`requestOTP` limitaba con un SELECT seguido de un INSERT, sin atomicidad: tres requests
concurrentes leían «no hay código activo» y las tres insertaban. Y `verifyOTP` compara contra UNA
sola fila —la más nueva—, así que quien abría el mail del PRIMER código **no podía entrar**.

No es teórico. `ricardoulisesgonzalez15@gmail.com` (17-jul-2026) pidió tres códigos en dos minutos,
falló dos intentos, se fue, y volvió **3 h 20 min** después a entrar con uno nuevo. Al 06-08 había
5 mails con más de un código sin usar.

⚠️ **CF no tiene tests automatizados.** Este archivo es el primero; sigue el patrón de
`test_conformidad.sql` (afirmar contra lo vivo) porque es el que el repo ya usa.

Requiere la migración `0112_otp_un_solo_codigo_vivo.sql` aplicada para que `--live` pase.
"""
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ACTIONS = (ROOT / "app" / "(auth)" / "gate" / "actions.ts").read_text()
MIG = ROOT / "supabase" / "migrations" / "0112_otp_un_solo_codigo_vivo.sql"

CASES = []
def case(name, fn): CASES.append((name, fn))


# ── el ORDEN, que es lo contraintuitivo ──────────────────────────────────────────────────────
# «Invalidar lo anterior y después insertar» NO arregla la carrera: el segundo request mataría el
# código del primero y la persona quedaría con uno muerto en la mano. Se inserta PRIMERO y arbitra
# la base. Este test afirma ese orden, que es justo lo que alguien "ordenando" el código rompería.
case("el INSERT va ANTES de cualquier invalidación (si no, la carrera vuelve)",
     lambda: ACTIONS.index("insert(fila)") < ACTIONS.index("used_at: new Date().toISOString()"))
case("se detecta la violación de unicidad (23505), no cualquier error",
     lambda: "'23505'" in ACTIONS and "UNIQUE_VIOLATION" in ACTIONS)
# La propiedad, no la distancia: entre la rama de la ráfaga y la de «código viejo» tiene que haber
# un `return`. La primera versión de este caso contaba caracteres (220) y se rompió sola con un
# `console.warn` largo — medir la letra otra vez, en el archivo que existe justo por eso.
case("una ráfaga NO manda un segundo mail (devuelve ok:true reusando el vivo)",
     lambda: 0 < ACTIONS.index("return { ok: true }", ACTIONS.index("if (vivo && fresco)"))
                < ACTIONS.index("if (vivo) {", ACTIONS.index("if (vivo && fresco)")))
case("un código VIEJO o vencido sí se invalida y se emite uno nuevo",
     lambda: "if (vivo) {" in ACTIONS and ACTIONS.count("insert(fila)") == 2)
case("NO se afloja el vencimiento: sigue en 10 minutos",
     lambda: "const OTP_TTL_MIN = 10" in ACTIONS)
case("NO se afloja el tope de intentos",
     lambda: "const OTP_MAX_ATTEMPTS = 3" in ACTIONS)
case("`verifyOTP` sigue exigiendo sin-usar y sin-vencer",
     lambda: ".is('used_at', null)" in ACTIONS and "row.expires_at" in ACTIONS)
case("la migración existe y crea el índice único parcial",
     lambda: MIG.exists() and "unique index if not exists uq_email_verifications_activo" in MIG.read_text()
             and "where used_at is null" in MIG.read_text())
case("y limpia los duplicados ANTES (si no, el índice no se puede crear)",
     lambda: "row_number() over (partition by email" in MIG.read_text())


def env():
    out = {}
    for f in (".env.local", ".env"):
        p = ROOT / f
        if p.exists():
            for l in p.read_text().splitlines():
                l = l.strip()
                if l and not l.startswith("#") and "=" in l:
                    k, v = l.split("=", 1)
                    out.setdefault(k, v.strip().strip('"').strip("'"))
    return out


def live():
    e = env()
    U, K = e["NEXT_PUBLIC_SUPABASE_URL"], e["SUPABASE_SERVICE_ROLE_KEY"]

    def get(q):
        r = urllib.request.Request(f"{U}/rest/v1/{q}",
                                   headers={"apikey": K, "Authorization": f"Bearer {K}",
                                            "User-Agent": "Mozilla/5.0"})
        return json.loads(urllib.request.urlopen(r, timeout=30).read())

    rows = get("email_verifications?select=email&used_at=is.null&limit=5000")
    import collections
    c = collections.Counter(x["email"] for x in rows)
    dups = {k: v for k, v in c.items() if v > 1}
    ok = not dups
    print(("  OK   " if ok else "  FAIL ") +
          f"[live] ningún mail tiene más de un código vivo ({len(rows)} activos)")
    for k, v in list(dups.items())[:6]:
        print(f"         · {k}: {v}")
    if dups:
        print("         (¿corriste la migración 0112? el índice la exige limpia)")
    return int(ok), 1


def main():
    ok = 0
    for name, fn in CASES:
        try:
            passed = bool(fn())
        except Exception as ex:  # noqa: BLE001
            passed, name = False, f"{name}  [{ex}]"
        print(("  OK   " if passed else "  FAIL ") + name)
        ok += passed
    total = len(CASES)
    if "--live" in sys.argv:
        a, b = live(); ok += a; total += b
    else:
        print("\n  (sin --live: no se verificó el invariante contra la base)")
    print(f"\n{ok}/{total} passing")
    sys.exit(0 if ok == total else 1)


if __name__ == "__main__":
    main()

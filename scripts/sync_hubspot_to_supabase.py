#!/usr/bin/env python3
"""
sync_hubspot_to_supabase.py — La RUTA DE VUELTA (HubSpot → Supabase).

POR QUÉ EXISTE (D-008 en docs/DECISIONES.md)
  HubSpot es la base VIVA: las asesoras corrigen ahí DNI, CUIL, apellidos, fechas
  en cada llamada. Ese trabajo NUNCA bajaba a Supabase, que es de donde el MOTOR
  calcula los créditos. Resultado medido el 2026-07-20: de 321 leads del sindicato,
  ~31 DNI, ~46 CUIL y ~28 nombres estaban corregidos en HubSpot y mal en Supabase.
  El motor cotizaba sobre datos que ya sabíamos equivocados.

MODELO (D-008): propiedad de campos, NO sync bidireccional. Cada campo tiene UN
  dueño. HubSpot posee identidad + situación + estado de gestión (abajo). Todo lo
  que calcula el motor (loan_usd, qualifies, bucket, adus_*, credit_with_lot_usd)
  es de Supabase y este script NUNCA lo toca — ni siquiera lo lee de HubSpot.

SEGURIDAD (reglas de Andrea)
  - DRY-RUN por defecto. Sin --write no toca la base: imprime y deja 2 CSV para revisar.
  - --write hace BACKUP de las filas que va a cambiar (JSON con timestamp) ANTES de escribir.
  - NUNCA se agenda. Lo corre una persona. (El sync cada-1-minuto de n8n nos fundió el crédito.)
  - Match por teléfono; se guarda `synced_hubspot_id` en el lead → el próximo match es exacto.
  - NOMBRES: solo se pisan si el match es de ALTA confianza (comparten nombre). Los dudosos
    (posible colisión de teléfono: dos personas, un número) van al CSV de revisión, no se tocan.

USO
  cd ~/Projects/CONSTRUIRFACIL
  python3 scripts/sync_hubspot_to_supabase.py            # dry-run: no escribe nada
  python3 scripts/sync_hubspot_to_supabase.py --write    # aplica (pide backup primero)

Requiere en .env (gitignored): HUBSPOT_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Stdlib only. NUNCA imprime tokens.
"""
import os, re, sys, csv, json, datetime, urllib.request, urllib.error

DRY = "--write" not in sys.argv
STAMP = None  # se setea en main() para no usar Date.now en import

# --- Campos que HubSpot POSEE. (col_supabase, prop_hubspot, tipo) --------------
# 'name' se maneja aparte (split nombre/apellido + gate de confianza).
IDENTITY = [
    ("dni",   "dni",           "num"),
    ("cuil",  "cuil",          "num"),
    ("email", "email",         "text"),
    ("phone", "phone",         "text"),
    ("fecha_nacimiento", "date_of_birth", "date"),   # el guard 0100 la valida al escribir
]
SITUACION = [
    ("first_home",     "first_home",     "bool"),
    ("has_lot",        "has_lot",        "bool"),
    # has_anticipo: HubSpot NO tiene booleano; guarda 'savings_ars' (monto). Derivar
    # has_anticipo = (monto>0) es una decisión de negocio → se deja FUERA hasta confirmarlo.
]
# credit_with_lot_usd, loan_usd, bucket, qualifies, etc.: propiedad del MOTOR. NO se listan a propósito.

HS_PROPS = "firstname,lastname," + ",".join(p for _, p, _ in IDENTITY + SITUACION)


def env():
    e = {}
    for f in (".env", ".env.local"):
        if os.path.exists(f):
            for line in open(f):
                m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*)$", line)
                if m:
                    e.setdefault(m.group(1), m.group(2).strip().strip('"').strip("'"))
    for k in ("HUBSPOT_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not e.get(k):
            sys.exit(f"FALTA {k} en .env")
    return e


def http(url, headers, method="GET", body=None):
    r = urllib.request.Request(url, method=method,
                               data=json.dumps(body).encode() if body else None, headers=headers)
    try:
        d = urllib.request.urlopen(r).read()
        return json.loads(d) if d else {}
    except urllib.error.HTTPError as ex:
        return {"_error": ex.code, "_body": ex.read().decode()[:300]}


def norm_phone(p):
    d = re.sub(r"\D", "", p or "")
    return d[-8:] if len(d) >= 8 else None


def digits(s):
    return re.sub(r"\D", "", s or "")


def to_bool(hs_val):
    """first_home / has_lot de HubSpot ('Yes'/'No'/'Sí'/...) → bool o None."""
    if hs_val in (None, ""):
        return None
    v = str(hs_val).strip().lower()
    if v in ("yes", "sí", "si", "true"):
        return True
    if v in ("no", "false"):
        return False
    return None


def name_conf(sb_name, sb_ape, hs_first, hs_last):
    """¿El match de nombre es de ALTA confianza? Comparten >=1 token largo y difieren
    en <=1 token. Así 'Poncela Valentin'→'Paredes Valentin' pasa (comparten valentin,
    cambia 1) pero 'Lucciana Vornero Anito'→'Luciana Vanesa Arrieta' NO (0 compartidos)."""
    def toks(*xs):
        t = re.sub(r"[^a-záéíóúñ ]", "", " ".join(x or "" for x in xs).lower())
        return {w for w in t.split() if len(w) >= 3}
    a, b = toks(sb_name, sb_ape), toks(hs_first, hs_last)
    if not a or not b:
        return False
    shared = a & b
    return bool(shared) and max(len(a - b), len(b - a)) <= 1


def main():
    global STAMP
    e = env()
    STAMP = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    SB, SK, HT = e["NEXT_PUBLIC_SUPABASE_URL"], e["SUPABASE_SERVICE_ROLE_KEY"], e["HUBSPOT_TOKEN"]
    sbh = {"apikey": SK, "Authorization": f"Bearer {SK}", "Content-Type": "application/json"}
    hsh = {"Authorization": f"Bearer {HT}", "Content-Type": "application/json"}

    # --- Supabase: leads del sindicato ---
    cols = "id,name,apellido,synced_hubspot_id," + ",".join(c for c, _, _ in IDENTITY + SITUACION)
    leads = http(f"{SB}/rest/v1/leads?select={cols}&source=eq.sindicato_uocra&limit=2000", sbh)
    by_phone = {}
    for l in leads:
        k = norm_phone(l["phone"])
        if k:
            by_phone.setdefault(k, l)

    # --- HubSpot: todos los contactos (paginado) ---
    contacts, after = [], None
    while True:
        url = f"https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties={HS_PROPS}"
        if after:
            url += f"&after={after}"
        d = http(url, hsh)
        contacts += d.get("results", [])
        after = d.get("paging", {}).get("next", {}).get("after")
        if not after:
            break

    print(f"{'DRY-RUN (no escribe)' if DRY else '*** WRITE ***'}  ·  "
          f"HubSpot: {len(contacts)} contactos  ·  Supabase sindicato: {len(leads)} leads\n")

    auto_changes, review_rows, links = [], [], []
    matched = 0
    for c in contacts:
        p = c["properties"]
        k = norm_phone(p.get("phone"))
        lead = by_phone.get(k) if k else None
        if not lead:
            continue
        matched += 1
        hsid = c["id"]
        if lead.get("synced_hubspot_id") != hsid:
            links.append((lead["id"], lead["name"], hsid))

        # --- campos numéricos + situación: inequívocos, auto ---
        for col, prop, typ in IDENTITY + SITUACION:
            if col == "phone":
                continue  # la llave; no la pisamos con ella misma
            hv = p.get(prop)
            if hv in (None, ""):
                continue
            sv = lead.get(col)
            if typ == "num":
                if digits(hv) and digits(hv) != digits(str(sv or "")):
                    auto_changes.append((lead, col, sv, hv, "identidad"))
            elif typ == "bool":
                hb = to_bool(hv)
                if hb is not None and hb != sv:
                    auto_changes.append((lead, col, sv, hb, "situación"))
            elif typ == "date":
                if str(hv)[:10] != str(sv or "")[:10]:
                    auto_changes.append((lead, col, sv, str(hv)[:10], "identidad"))
            else:  # text
                if str(hv).strip().lower() != str(sv or "").strip().lower():
                    auto_changes.append((lead, col, sv, hv, "identidad"))

        # --- nombre: gate de confianza ---
        hf, hl = p.get("firstname"), p.get("lastname")
        sb_full = f"{lead['name'] or ''} {lead['apellido'] or ''}".strip().lower()
        hs_full = f"{hf or ''} {hl or ''}".strip().lower()
        if hs_full and hs_full != sb_full:
            if name_conf(lead["name"], lead["apellido"], hf, hl):
                auto_changes.append((lead, "name", lead["name"], hf, "nombre-alta-conf"))
                auto_changes.append((lead, "apellido", lead["apellido"], hl, "nombre-alta-conf"))
            else:
                review_rows.append([lead["id"], sb_full, hs_full, p.get("phone"), c["id"]])

    print(f"matcheados por teléfono: {matched}/{len(leads)}   ·   "
          f"vínculos nuevos a guardar: {len(links)}")
    print(f"cambios automáticos propuestos: {len(auto_changes)}   ·   "
          f"nombres a revisar a mano: {len(review_rows)}\n")

    by_field = {}
    for _, col, _, _, _ in auto_changes:
        by_field[col] = by_field.get(col, 0) + 1
    for col, n in sorted(by_field.items(), key=lambda x: -x[1]):
        print(f"   {col:18} {n}")

    # --- CSVs para revisar (siempre, aun en dry-run) ---
    ch_path = f"/tmp/sync_cambios_{STAMP}.csv"
    with open(ch_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lead_id", "nombre", "campo", "supabase_actual", "hubspot_nuevo", "tipo"])
        for l, col, old, new, tag in auto_changes:
            w.writerow([l["id"], l["name"], col, old, new, tag])
    rv_path = f"/tmp/sync_revisar_nombres_{STAMP}.csv"
    with open(rv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lead_id", "supabase", "hubspot", "telefono", "hubspot_id"])
        w.writerows(review_rows)
    print(f"\n📄 cambios propuestos → {ch_path}")
    print(f"📄 nombres a revisar  → {rv_path}")

    if DRY:
        print("\nDRY-RUN: no se escribió nada. Revisá los CSV y corré con --write para aplicar.")
        return

    # --- WRITE: backup primero, después escribir ---
    touched = {l["id"]: l for l, *_ in auto_changes}
    for lid, _, _ in links:
        touched.setdefault(lid, next(l for l in leads if l["id"] == lid))
    bpath = f"/tmp/backup_sync_{STAMP}.json"
    json.dump(list(touched.values()), open(bpath, "w"), indent=1, ensure_ascii=False)
    print(f"\n✅ backup de {len(touched)} filas → {bpath}")

    # agrupar cambios por lead
    patch = {}
    for l, col, _, new, _ in auto_changes:
        patch.setdefault(l["id"], {})[col] = new
    for lid, _, hsid in links:
        patch.setdefault(lid, {})["synced_hubspot_id"] = hsid
        patch[lid]["synced_hubspot_at"] = datetime.datetime.now().isoformat()

    ok = 0
    for lid, body in patch.items():
        r = http(f"{SB}/rest/v1/leads?id=eq.{lid}", {**sbh, "Prefer": "return=minimal"}, "PATCH", body)
        if isinstance(r, dict) and r.get("_error"):
            print(f"   ❌ {lid}: {r}")
        else:
            ok += 1
    print(f"✅ {ok}/{len(patch)} leads actualizados.")
    print("⚠️ Los campos de SITUACIÓN cambiaron → hay que RECALCULAR el crédito (qualify_leads.sql).")


if __name__ == "__main__":
    main()

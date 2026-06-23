#!/usr/bin/env python3
"""HubSpot CF props -> ENGLISH (internationalization).

Internal names are immutable in HubSpot, so "rename" = create EN prop + migrate the contacts'
values + archive the ES prop. We do all three in one script, in safe order, each step verifiable.

  (no args)   diagnostic: show which EN props exist + which ES props still hold data
  --create    create the EN props (additive, safe, idempotent) + relabel kept-enum options to EN
  --migrate   copy values ES->EN on every contact that has the ES prop (idempotent, batched)
  --archive   archive the ES props (DESTRUCTIVE — run only after --migrate verified)

KEEP as-is (already English internal): dni (UNIQUE upsert key — never touch), form_date.
RELABEL only (keep internal name + values): blocker_code (EN option labels).
NEVER prints the token. Stdlib only.
"""
import os, sys, json, urllib.request, urllib.error, time

BASE = "https://api.hubapi.com/crm/v3"
GROUP = "contactinformation"

TOKEN = None
for _l in open(os.path.join(os.path.dirname(__file__), "..", ".env")):
    if _l.startswith("HUBSPOT_TOKEN="):
        TOKEN = _l.strip().split("=", 1)[1]
if not TOKEN:
    sys.exit("HUBSPOT_TOKEN no está en .env")


def api(path, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return {"_error": e.code, "_body": e.read().decode()[:400]}


# old ES internal name -> new EN internal name. (Migration + value copy uses this map.)
RENAME = {
    "ahorro_ars": "savings_ars", "blocker_cf": "blocker_prose", "bucket_cf": "bucket",
    "campana": "campaign", "credito_con_lote_usd": "credit_with_lot_usd",
    "credito_hoy_usd": "credit_now_usd", "cuil_lead": "cuil", "delegado": "union_delegate",
    "estado_civil_cf": "marital_status", "estado_consentimiento": "consent_status",
    "ingreso_ars": "income_ars", "lead_score_cf": "lead_score", "primera_vivienda": "first_home",
    "prioridad_cf": "priority", "programa_recomendado": "recommended_program",
    "provincia_cf": "province", "proximo_paso": "next_step", "residencia_anios": "residency_years",
    "revisar": "review_flags", "seccional": "union_section", "tiene_lote_cf": "has_lot",
}

def txt(name, label): return {"name": name, "label": label, "type": "string", "fieldType": "text", "groupName": GROUP}
def num(name, label): return {"name": name, "label": label, "type": "number", "fieldType": "number", "groupName": GROUP}
def en(name, label, opts): return {"name": name, "label": label, "type": "enumeration", "fieldType": "select",
                                   "groupName": GROUP, "options": [{"label": l, "value": v, "displayOrder": i, "hidden": False}
                                                                   for i, (v, l) in enumerate(opts)]}

# EN property definitions (the create set). Enum values PRESERVED from source; only labels EN.
TO_CREATE = [
    en("bucket", "Qualification bucket", [("READY", "Ready"), ("READY_BLOCKED", "Ready – blocked"),
                                          ("QUALIFIES_LATER", "Qualifies later"), ("NOT_A_FIT", "Not a fit")]),
    txt("blocker_prose", "Blocker (prose)"),
    num("credit_now_usd", "Credit now (USD)"),
    num("credit_with_lot_usd", "Credit with lot (USD)"),
    num("income_ars", "Monthly income (ARS)"),
    num("savings_ars", "Savings / down payment (ARS)"),
    num("residency_years", "Residency (years)"),
    txt("first_home", "First home"),
    txt("province", "Province"),
    txt("campaign", "Campaign"),
    txt("marital_status", "Marital status"),
    txt("consent_status", "Consent status"),
    txt("recommended_program", "Recommended program"),
    txt("next_step", "Next step"),
    en("priority", "Priority", [("A·Vende ya", "A · Sell now"), ("B·Pipeline", "B · Pipeline"),
                                ("Hold·Consentir", "Hold · Consent"), ("Hold·Revisar", "Hold · Review"),
                                ("Hold·Falta dato", "Hold · Missing data")]),
    num("lead_score", "Lead score"),
    txt("review_flags", "Review flags"),
    txt("union_section", "Union section"),
    txt("union_delegate", "Union delegate"),
    txt("cuil", "CUIL (Argentina)"),
    en("has_lot", "Has lot", [("Si", "Yes"), ("No", "No")]),
]

# kept-internal enums: relabel options to EN (non-destructive PATCH), values preserved.
RELABEL = {
    "blocker_code": [("tierra", "Land"), ("escritura", "Deed"), ("codeudor", "Co-borrower"),
                     ("ingreso", "Income"), ("ahorro", "Savings"), ("consentimiento", "Consent"),
                     ("dato", "Data"), ("ninguno", "None")],
}


def existing_names():
    r = api("/properties/contacts")
    return {p["name"] for p in r.get("results", [])}


def cmd_create():
    have = existing_names()
    for p in TO_CREATE:
        if p["name"] in have:
            print(f"  = {p['name']:22} ya existe, skip")
            continue
        res = api("/properties/contacts", "POST", p)
        print(f"  {'✓' if '_error' not in res else '✗'} {p['name']:22} {p['label']}" + (f"  ERR {res.get('_error')}: {res.get('_body')}" if '_error' in res else ""))
    for name, opts in RELABEL.items():
        body = {"options": [{"label": l, "value": v, "displayOrder": i, "hidden": False} for i, (v, l) in enumerate(opts)]}
        res = api(f"/properties/contacts/{name}", "PATCH", body)
        print(f"  {'✓' if '_error' not in res else '✗'} relabel {name}" + (f"  ERR {res.get('_error')}: {res.get('_body')}" if '_error' in res else ""))


def all_contacts():
    """Page through all contacts, fetching the ES props we need to migrate."""
    props = list(RENAME.keys())
    out, after = [], None
    while True:
        q = "/objects/contacts?limit=100&properties=" + ",".join(props)
        if after: q += "&after=" + after
        r = api(q)
        out.extend(r.get("results", []))
        after = (r.get("paging", {}).get("next") or {}).get("after")
        if not after: break
    return out


def cmd_migrate():
    contacts = all_contacts()
    print(f"  {len(contacts)} contactos. Copiando valores ES->EN...")
    moved = 0
    for c in contacts:
        props = c.get("properties", {})
        patch = {}
        for es, en_ in RENAME.items():
            v = props.get(es)
            if v not in (None, ""):
                patch[en_] = v
        if patch:
            res = api(f"/objects/contacts/{c['id']}", "PATCH", {"properties": patch})
            moved += 1 if "_error" not in res else 0
            if "_error" in res:
                print(f"  ✗ {c['id']}: {res.get('_error')} {res.get('_body')}")
            time.sleep(0.12)  # be gentle on rate limits
    print(f"  ✓ {moved}/{len(contacts)} contactos migrados")


def cmd_archive():
    for es in RENAME:
        res = api(f"/properties/contacts/{es}", "DELETE")  # DELETE archives in v3
        print(f"  {'✓' if '_error' not in res else '✗'} archive {es}" + (f"  ERR {res.get('_error')}" if '_error' in res else ""))


def cmd_diag():
    have = existing_names()
    print("EN props creadas:")
    for p in TO_CREATE:
        print(f"  {'✓' if p['name'] in have else '·'} {p['name']}")
    print("ES props (origen) presentes:")
    for es in RENAME:
        print(f"  {'•' if es in have else '·'} {es} -> {RENAME[es]}")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    {"--create": cmd_create, "--migrate": cmd_migrate, "--archive": cmd_archive}.get(arg, cmd_diag)()

#!/usr/bin/env python3
"""
HubSpot — diagnóstico + creación de propiedades de Contact vía Properties API.

POR QUÉ EXISTE: el UI "Create new property" devuelve un error genérico
("There was a problem creating this property") en TODA creación, a nivel cuenta
(falla en 3 browsers + sesión nueva, HubSpot operativo). La API nos devuelve el
ERROR REAL y además crea las props esquivando el UI roto.

USO:
  1) Agregá al .env (gitignored) de CONSTRUIRFACIL:  HUBSPOT_TOKEN=pat-xxxxx
     (Private App token; scopes: crm.schemas.contacts.write + crm.objects.contacts.write)
  2) cd ~/Projects/CONSTRUIRFACIL && python3 scripts/hubspot_props.py
     - sin args  -> sólo DIAGNÓSTICO (lista lo que existe, NO crea nada)
     - --create  -> además intenta crear las props de TO_CREATE y muestra el resultado

NUNCA imprime el token. Stdlib only (sin requests).
"""
import os, sys, json, urllib.request, urllib.error

BASE = "https://api.hubapi.com/crm/v3/properties/contacts"

# Palabras clave para cazar fantasmas / ver qué ya existe (de nuestros 2 días de intentos)
KEYWORDS = ["cuil", "dni", "zztest", "uocra", "bucket", "ahorro", "ingreso",
            "blocker", "seccional", "delegado", "prioridad", "programa",
            "residencia", "consent", "form_date", "campana", "revisar",
            "proximo", "credito", "primera", "tiene_lote", "lead_score"]

GROUP = "contactinformation"


def t(name, label):   # single-line text
    return {"name": name, "label": label, "type": "string",
            "fieldType": "text", "groupName": GROUP}


def num(name, label):  # number
    return {"name": name, "label": label, "type": "number",
            "fieldType": "number", "groupName": GROUP}


def date(name, label):  # date (epoch ms medianoche UTC; el import lo arma desde YYYY-MM-DD)
    return {"name": name, "label": label, "type": "date",
            "fieldType": "date", "groupName": GROUP}


def enum(name, label, values):  # dropdown. value == string exacto del CSV (match bulletproof)
    opts = [{"label": v, "value": v, "displayOrder": i, "hidden": False}
            for i, v in enumerate(values)]
    return {"name": name, "label": label, "type": "enumeration",
            "fieldType": "select", "groupName": GROUP, "options": opts}


# Set completo del import. Idempotente: lo que ya existe (cuil_lead/dni/tiene_lote_cf) se saltea.
# NATIVOS (no se crean): firstname/lastname, phone, email, date_of_birth.
# YA EXISTEN: dni (unique), tiene_lote_cf (enum) -> el CSV mapea ahí.
TO_CREATE = [
    t("cuil_lead", "CUIL (Argentina)"),          # ya creada; queda por idempotencia
    t("campana", "Campaña"),
    t("provincia_cf", "Provincia (CF)"),
    t("seccional", "Seccional"),
    t("delegado", "Delegado"),
    num("ingreso_ars", "Ingreso mensual ARS"),
    num("ahorro_ars", "Ahorro / anticipo ARS"),
    num("credito_hoy_usd", "Crédito hoy USD"),
    num("credito_con_lote_usd", "Crédito c/lote USD"),
    num("lead_score_cf", "Lead score"),
    num("residencia_anios", "Residencia (años)"),
    t("blocker_cf", "Blocker (prosa)"),
    t("programa_recomendado", "Programa recomendado"),
    t("proximo_paso", "Próximo paso"),
    t("revisar", "Revisar (flags)"),
    t("primera_vivienda", "Primera vivienda"),
    t("estado_civil_cf", "Estado civil"),
    t("estado_consentimiento", "Estado consentimiento"),
    date("form_date", "Fecha del form"),
    # --- enumeration (valores autoritativos donde existen) ---
    enum("bucket_cf", "Bucket calificación",         # qualify_leads.sql
         ["READY", "QUALIFIES_LATER", "NOT_A_FIT"]),
    enum("blocker_code", "Blocker code",             # migración 0083 (enum atómico)
         ["tierra", "escritura", "codeudor", "ingreso", "ahorro",
          "consentimiento", "dato", "ninguno"]),
    enum("prioridad_cf", "Prioridad",                # reconstrucción del export (verificar c/CSV)
         ["A·Vende ya", "B·Pipeline", "Hold·Consentir", "Hold·Revisar", "Hold·Falta dato"]),
]


def load_token():
    t = os.environ.get("HUBSPOT_TOKEN")
    if t:
        return t.strip()
    here = os.path.dirname(os.path.abspath(__file__))
    for p in [os.path.join(here, "..", ".env"), ".env"]:
        try:
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("HUBSPOT_TOKEN"):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except FileNotFoundError:
            continue
    return None


def call(url, token, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"raw": "<no-json body>"}


def diagnose(token):
    print("=" * 70)
    print("DIAGNÓSTICO — propiedades de Contact existentes")
    print("=" * 70)
    total = 0
    hits = []
    for archived in (False, True):
        st, payload = call(f"{BASE}?archived={'true' if archived else 'false'}&limit=500", token)
        if st != 200:
            print(f"  [archived={archived}] HTTP {st}: {json.dumps(payload)[:400]}")
            continue
        props = payload.get("results", [])
        if not archived:
            total = len(props)
        for p in props:
            name = (p.get("name") or "").lower()
            label = (p.get("label") or "").lower()
            if any(k in name or k in label for k in KEYWORDS):
                hits.append((archived, p.get("name"), p.get("label"),
                             p.get("type"), p.get("hasUniqueValue")))
    print(f"\nTotal propiedades activas: {total}")
    print(f"\nCoincidencias con nuestras keywords (archived? | name | label | type | unique):")
    if not hits:
        print("  (ninguna)")
    for arch, name, label, typ, uniq in sorted(hits):
        tag = "ARCHIVADA" if arch else "activa   "
        print(f"  [{tag}] {name:24} | {label:24} | {typ:12} | unique={uniq}")
    print()


def existing_names(token):
    names = set()
    st, payload = call(f"{BASE}?archived=false&limit=500", token)
    if st == 200:
        names = {p.get("name") for p in payload.get("results", [])}
    return names


def create(token):
    print("=" * 70)
    print("CREACIÓN — set completo del import (idempotente: saltea lo que ya existe)")
    print("=" * 70)
    have = existing_names(token)
    created = skipped = failed = 0
    for spec in TO_CREATE:
        if spec["name"] in have:
            print(f"  ·   {spec['name']:22} -> ya existe, skip")
            skipped += 1
            continue
        st, payload = call(BASE, token, method="POST", body=spec)
        if st in (200, 201):
            print(f"  OK  {spec['name']:22} -> creada ({spec['type']}/{spec['fieldType']})")
            created += 1
        else:
            print(f"  ✗   {spec['name']:22} -> HTTP {st}: "
                  f"{json.dumps(payload, ensure_ascii=False)[:300]}")
            failed += 1
    print(f"\nResumen: {created} creadas · {skipped} ya existían · {failed} fallaron")
    print()


def main():
    token = load_token()
    if not token:
        print("FALTA HUBSPOT_TOKEN. Agregalo al .env (gitignored) de CONSTRUIRFACIL:")
        print('  HUBSPOT_TOKEN=pat-xxxxx')
        sys.exit(1)
    diagnose(token)
    if "--create" in sys.argv:
        create(token)
    else:
        print("(diagnóstico solo. Corré con  --create  para intentar crear cuil_lead.)")


if __name__ == "__main__":
    main()

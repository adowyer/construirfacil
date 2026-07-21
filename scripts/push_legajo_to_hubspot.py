#!/usr/bin/env python3
"""
push_legajo_to_hubspot.py — Legajo Nro.: Supabase → HubSpot (una sola dirección).

POR QUÉ EXISTE (D-009 + D-008)
  El Legajo Nro. lo EMITE Supabase (`emitir_legajos()`), que es el único lugar donde
  se calcula la letra y se consume el correlativo. HubSpot lo LEE para que las
  asesoras lo vean y lo digan por teléfono. Nunca al revés: un legajo escrito a mano
  en el CRM se desincroniza — la misma clase de falla que nos costó 40 cotizaciones
  mal (ver D-001).

  Por eso `sync_hubspot_to_supabase.py` NO lista `legajo_nro`, y este script no lee
  el valor de HubSpot para nada: lo pisa con el de Supabase, siempre.

QUÉ ESCRIBE
  1. `legajo_nro` ("🗂️ Legajo Nro.") — siempre, pisando lo que haya.
  2. `has_anticipo` ("¿Tiene anticipo?") — SOLO si en HubSpot está vacío. Es la
     siembra inicial de una propiedad creada el 2026-07-21: de 299 personas ya
     sabíamos la respuesta y no tenía sentido mostrarlas como sin responder.
     A partir de ahí manda el CRM (D-008) y este script no la toca más.

SEGURIDAD (reglas de Andrea)
  - DRY-RUN por defecto. Sin --write no toca HubSpot: imprime qué haría.
  - NUNCA se agenda. Lo corre una persona. (El sync cada-1-minuto nos fundió n8n.)
  - Match por `synced_hubspot_id` (exacto, lo dejó el sync del 2026-07-20); si el
    lead no lo tiene, cae a teléfono normalizado. Sin match → se reporta, no se inventa.
  - Es idempotente: solo escribe donde el valor de HubSpot difiere del de Supabase.

USO
  cd ~/Projects/CONSTRUIRFACIL
  python3 scripts/push_legajo_to_hubspot.py            # dry-run
  python3 scripts/push_legajo_to_hubspot.py --write    # aplica

Requiere en .env (gitignored): HUBSPOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY.
Stdlib only. NUNCA imprime tokens.
"""
import os, re, sys, json, urllib.request, urllib.error

DRY = "--write" not in sys.argv

PROP_NAME  = "legajo_nro"
PROP_LABEL = "🗂️ Legajo Nro."
PROP_DESC  = ("Legajo de la solicitud. Letra + 5 dígitos: A lote+anticipo · B lote sin anticipo · "
              "C sin lote con anticipo · D ninguno. La letra dice cómo entró la persona, no cómo "
              "está hoy: NO cambia nunca. Lo emite el sistema — no editar a mano.")
GROUP = "contactinformation"


# --- infra -------------------------------------------------------------------
def env():
    e = dict(os.environ)
    try:
        for line in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                e.setdefault(k, v.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass
    return e


def call(url, token, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"raw": "<no-json>"}


def sb(url, key, q):
    req = urllib.request.Request(f"{url}/rest/v1/{q}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def norm_phone(p):
    d = re.sub(r"\D", "", p or "")
    return d[-8:] if len(d) >= 8 else None   # últimos 8: sobrevive prefijos 0/54/9/área


def norm_dni(d):
    s = re.sub(r"\D", "", str(d or ""))
    return s if 7 <= len(s) <= 8 else None


_SMALL = {"de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos"}

def tokens(*parts):
    """Palabras significativas del nombre, sin tildes ni partículas."""
    s = " ".join(p or "" for p in parts).lower()
    s = s.translate(str.maketrans("áéíóúüñ", "aeiouun"))
    return {w for w in re.findall(r"[a-z]+", s) if len(w) > 2 and w not in _SMALL}


def name_key(*parts):
    return "".join(sorted(tokens(*parts)))


# --- pasos -------------------------------------------------------------------
def ensure_property(token):
    """Crea la propiedad si no existe. Aditivo: nunca borra ni cambia el tipo
    (en HubSpot el tipo es inmutable — cambiarlo exige borrar y recrear)."""
    code, r = call(f"https://api.hubapi.com/crm/v3/properties/contacts/{PROP_NAME}", token)
    if code == 200:
        print(f"  propiedad '{PROP_NAME}' ya existe ({r.get('label')})")
        return True
    if DRY:
        print(f"  [dry-run] crearía la propiedad '{PROP_NAME}' ({PROP_LABEL})")
        return False
    code, r = call("https://api.hubapi.com/crm/v3/properties/contacts", token, "POST", {
        "name": PROP_NAME, "label": PROP_LABEL, "description": PROP_DESC,
        "type": "string", "fieldType": "text", "groupName": GROUP})
    if code in (200, 201):
        print(f"  ✅ propiedad '{PROP_NAME}' creada")
        return True
    print(f"  ❌ no se pudo crear la propiedad: {code} {r}")
    sys.exit(1)


def hs_contacts(token):
    """Todos los contactos con id, teléfono y legajo actual."""
    out, after = [], None
    while True:
        url = ("https://api.hubapi.com/crm/v3/objects/contacts"
               f"?limit=100&properties=phone,firstname,lastname,dni,has_anticipo,{PROP_NAME}"
               + (f"&after={after}" if after else ""))
        code, r = call(url, token)
        if code != 200:
            print(f"❌ HubSpot {code}: {r}"); sys.exit(1)
        out += r.get("results", [])
        after = (r.get("paging") or {}).get("next", {}).get("after")
        if not after:
            return out


def main():
    e = env()
    token = e.get("HUBSPOT_TOKEN")
    url, key = e.get("SUPABASE_URL"), e.get("SUPABASE_SERVICE_KEY")
    if not (token and url and key):
        print("❌ faltan HUBSPOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_KEY en .env"); sys.exit(1)

    print(f"\n{'DRY-RUN (no escribe nada)' if DRY else '⚠️  MODO ESCRITURA'}\n")

    print("1. Propiedad en HubSpot")
    ensure_property(token)

    print("\n2. Legajos en Supabase")
    leads = sb(url, key, "leads?select=id,name,apellido,phone,dni,has_anticipo,legajo_nro,synced_hubspot_id"
                         "&legajo_nro=not.is.null&limit=2000")
    print(f"  {len(leads)} leads con legajo")

    print("\n3. Contactos en HubSpot")
    contacts = hs_contacts(token)
    by_id = {c["id"]: c for c in contacts}
    by_phone, by_dni, by_name = {}, {}, {}
    for c in contacts:
        p = c.get("properties") or {}
        if norm_phone(p.get("phone")):
            by_phone.setdefault(norm_phone(p["phone"]), []).append(c)   # lista: puede haber colisión
        if norm_dni(p.get("dni")):
            by_dni.setdefault(norm_dni(p["dni"]), []).append(c)
        if name_key(p.get("firstname"), p.get("lastname")):
            by_name.setdefault(name_key(p.get("firstname"), p.get("lastname")), []).append(c)
    print(f"  {len(contacts)} contactos")

    # Escalera de match, de más exacto a menos. Solo se acepta candidato ÚNICO.
    #   1. synced_hubspot_id — lo dejó el sync del 2026-07-20. Exacto.
    #   2. teléfono (últimos 8).
    #   3. DNI + al menos una palabra del nombre en común. El nombre NO es
    #      decorativo: el DNI de Supabase puede estar desactualizado y coincidir
    #      con el DNI correcto de OTRA persona en HubSpot — nos pasó el 2026-07-20
    #      con Ramirez/García. Sin el nombre, ese caso escribe el legajo al
    #      contacto equivocado y nadie se entera.
    #   4. nombre completo idéntico (mismo conjunto de palabras).
    updates, ya_ok, sin_match, ambiguos = [], 0, [], []
    via = {"id": 0, "phone": 0, "dni": 0, "name": 0}
    for l in leads:
        c = by_id.get(str(l.get("synced_hubspot_id") or ""))
        if c:
            via["id"] += 1
        if not c:
            cands = by_phone.get(norm_phone(l.get("phone")) or "", [])
            if len(cands) == 1:
                c = cands[0]; via["phone"] += 1
            elif len(cands) > 1:
                ambiguos.append(l); continue
        if not c:
            cands = by_dni.get(norm_dni(l.get("dni")) or "", [])
            if len(cands) == 1:
                cp = cands[0].get("properties") or {}
                if tokens(l.get("name"), l.get("apellido")) & tokens(cp.get("firstname"), cp.get("lastname")):
                    c = cands[0]; via["dni"] += 1
        if not c:
            cands = by_name.get(name_key(l.get("name"), l.get("apellido")) or "", [])
            if len(cands) == 1:
                c = cands[0]; via["name"] += 1
        if not c:
            sin_match.append(l); continue
        props = {}
        actual = (c.get("properties") or {}).get(PROP_NAME)
        if actual != l["legajo_nro"]:
            props[PROP_NAME] = l["legajo_nro"]

        # Siembra inicial de '¿Tiene anticipo?': la propiedad se creó vacía el
        # 2026-07-21, pero de 299 personas ya sabemos la respuesta. Se escribe
        # SOLO si HubSpot está vacío — a partir de ahí manda el CRM (D-008) y
        # este script no vuelve a tocarla nunca.
        if l.get("has_anticipo") is not None and not (c.get("properties") or {}).get("has_anticipo"):
            props["has_anticipo"] = "Si" if l["has_anticipo"] else "No"

        if not props:
            ya_ok += 1
        else:
            updates.append({"id": c["id"], "properties": props,
                            "_nombre": ((l.get("name") or "") + " " + (l.get("apellido") or "")).strip(),
                            "_antes": actual})

    print(f"\n4. Plan")
    print(f"  match por       : id {via['id']} · teléfono {via['phone']} · DNI+nombre {via['dni']} · nombre {via['name']}")
    print(f"  a escribir      : {len(updates)}")
    print(f"  ya correctos    : {ya_ok}")
    print(f"  sin match en HS : {len(sin_match)}")
    print(f"  teléfono ambiguo: {len(ambiguos)}  (dos contactos, un número → no se toca)")
    for u in updates[:5]:
        print(f"    {u['properties'][PROP_NAME]}  {u['_nombre'][:32]}"
              + (f"  (pisa '{u['_antes']}')" if u["_antes"] else ""))
    if len(updates) > 5:
        print(f"    … y {len(updates)-5} más")
    for l in sin_match[:10]:
        print(f"    sin match: {l['legajo_nro']}  {(l.get('name') or '')} {(l.get('apellido') or '')}  {l.get('phone')}")

    if DRY:
        print("\n(dry-run — no se escribió nada. Correr con --write para aplicar.)")
        return
    if not updates:
        print("\nNada que escribir."); return

    print(f"\n5. Escribiendo {len(updates)} contactos…")
    ok = err = 0
    for i in range(0, len(updates), 100):
        batch = [{"id": u["id"], "properties": u["properties"]} for u in updates[i:i+100]]
        code, r = call("https://api.hubapi.com/crm/v3/objects/contacts/batch/update",
                       token, "POST", {"inputs": batch})
        if code in (200, 201, 202):
            ok += len(batch)
        else:
            err += len(batch)
            print(f"  ❌ lote {i//100+1}: {code} {str(r)[:300]}")
    print(f"\n✅ {ok} actualizados · {err} con error")


if __name__ == "__main__":
    main()

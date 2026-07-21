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
    # has_anticipo: la propiedad '¿Tiene anticipo?' se creó el 2026-07-21 justamente
    # porque no existía dónde cargar la respuesta. NO se deriva de 'savings_ars':
    # medido, 7 personas dicen tener anticipo con el monto vacío (ver D-009).
    # Cuando la asesora la carga, este sync la baja y el legajo se emite solo.
    ("has_anticipo",   "has_anticipo",   "bool"),
]
# credit_with_lot_usd, loan_usd, bucket, qualifies, etc.: propiedad del MOTOR. NO se listan a propósito.

HS_PROPS = "firstname,lastname," + ",".join(p for _, p, _ in IDENTITY + SITUACION)

# Leads cuyo nombre difiere mucho pero Andrea YA verificó contra la ficha/Renaper:
# se sincronizan aunque el gate de confianza los marque dudosos. (2026-07-20)
APPROVED_NAMES = {
    "2480f30e-f45c-4a6e-a575-45364577ef31",  # Caso Carlos Esteban (no Dario)
    "3e8e8c86-cb61-4bac-8633-aa8526cc63ba",  # Luciana Vanesa Arrieta
    "0bf8aa97-6cd4-44db-9e2f-edddcd3352e7",  # Luciano Lima Matias Rios
    "2aaa39b2-cfdb-490a-ba59-03241d98b419",  # Abel Peña
    "5f2b5d80-2945-4df4-856b-5115aeeee68c",  # Solorza José Mariano
}

# Partículas que van en minúscula salvo al inicio del nombre.
_SMALL = {"de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos"}


def titlecase(s):
    """Capitaliza respetando acentos, ñ y partículas. 'josé maría de la cruz' → 'José María de la Cruz'."""
    if not s:
        return s
    out = []
    for i, w in enumerate(s.split()):
        wl = w.lower()
        out.append(wl if (i > 0 and wl in _SMALL) else (wl[:1].upper() + wl[1:]))
    return " ".join(out)


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


def norm_dni(d):
    s = re.sub(r"\D", "", str(d or ""))
    return s if 7 <= len(s) <= 8 else None


_SMALL_TOK = {"de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos"}

def name_toks(*parts):
    s = " ".join(x or "" for x in parts).lower()
    s = s.translate(str.maketrans("áéíóúüñ", "aeiouun"))
    return {w for w in re.findall(r"[a-z]+", s) if len(w) > 2 and w not in _SMALL_TOK}


def name_key(*parts):
    return "".join(sorted(name_toks(*parts)))


def cuil_valido(c):
    """El CUIL lleva su propio dígito verificador. Sirve de árbitro objetivo."""
    d = re.sub(r"\D", "", str(c or ""))
    if len(d) != 11:
        return False
    w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    r = 11 - (sum(int(d[i]) * w[i] for i in range(10)) % 11)
    return (0 if r == 11 else (9 if r == 10 else r)) == int(d[10])


def cuil_dni(c):
    d = re.sub(r"\D", "", str(c or ""))
    return d[2:10] if len(d) == 11 else None


def hubspot_refutado(lead, p):
    """¿Hay PRUEBA de que el DNI de HubSpot está mal y el de Supabase bien?

    Por defecto manda HubSpot (D-008) y así se queda: medido el 2026-07-21 sobre
    las 25 divergencias del grupo que nunca se sincronizó, HubSpot acertó 24 —
    las 5 dudosas las verificó Andrea contra las fichas.

    La excepción es una sola y es demostrable: si el CUIL es VÁLIDO, idéntico en
    los dos lados, y el DNI que lleva adentro es el de Supabase, entonces el DNI
    de HubSpot está mal por aritmética, no por opinión. (Caso Milagros Bolañuk,
    `Listado11.pdf`: HubSpot perdió un dígito al importar.)

    Sin esta excepción, aplicar D-008 a ciegas pisaría un dato bueno con uno roto.
    Es la misma trampa que la tasa: una decisión correcta llevada a un caso vecino
    que no es el mismo caso.
    """
    sd, hd = norm_dni(lead.get("dni")), norm_dni(p.get("dni"))
    if not (sd and hd) or sd == hd:
        return False
    sc = re.sub(r"\D", "", str(lead.get("cuil") or ""))
    hc = re.sub(r"\D", "", str(p.get("cuil") or ""))
    if not cuil_valido(sc):
        return False
    if hc and hc != sc:          # si HubSpot tiene OTRO cuil, no hay acuerdo → no hay prueba
        return False
    return cuil_dni(sc) == sd


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
    # Alcance: sindicato + web_form. Andrea, 2026-07-21: "debemos empezar a llamar
    # también a esos". Queda afuera web_chat (pruebas del lab, no son personas).
    leads = http(f"{SB}/rest/v1/leads?select={cols}"
                 f"&source=in.(sindicato_uocra,web_form)&limit=2000", sbh)

    # --- Índices para la escalera de match -----------------------------------
    # El sync del 2026-07-20 matcheaba SOLO por teléfono: enlazó 261 de 321 y los
    # ~60 restantes no recibieron nada — ni corrección, ni vínculo. No se veían en
    # ningún reporte, así que el punto ciego no era visible. Con esta escalera se
    # recuperan 61 de esos.
    by_hsid, by_phone, by_dni, by_name = {}, {}, {}, {}
    for l in leads:
        if l.get("synced_hubspot_id"):
            by_hsid[str(l["synced_hubspot_id"])] = l
        k = norm_phone(l["phone"])
        if k:
            by_phone.setdefault(k, []).append(l)
        d = norm_dni(l.get("dni"))
        if d:
            by_dni.setdefault(d, []).append(l)
        n = name_key(l.get("name"), l.get("apellido"))
        if n:
            by_name.setdefault(n, []).append(l)

    def buscar(c, p):
        """id → teléfono → DNI+nombre → nombre exacto. Solo candidato ÚNICO.

        El nombre en el escalón del DNI no es adorno: el DNI de Supabase puede
        estar desactualizado y coincidir con el DNI correcto de OTRA persona
        (caso Ramirez/García, 2026-07-20). Sin el nombre, se sincroniza la
        ficha equivocada y nadie se entera.
        """
        l = by_hsid.get(c["id"])
        if l:
            return l, "id"
        cands = by_phone.get(norm_phone(p.get("phone")) or "", [])
        if len(cands) == 1:
            return cands[0], "teléfono"
        if len(cands) > 1:
            return None, "teléfono-ambiguo"
        cands = by_dni.get(norm_dni(p.get("dni")) or "", [])
        if len(cands) == 1:
            a = name_toks(cands[0].get("name"), cands[0].get("apellido"))
            b = name_toks(p.get("firstname"), p.get("lastname"))
            if a & b:
                return cands[0], "DNI+nombre"
        cands = by_name.get(name_key(p.get("firstname"), p.get("lastname")) or "", [])
        if len(cands) == 1:
            return cands[0], "nombre"
        return None, None

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
    refutados, cuil_roto = [], []
    matched = 0
    via = {}
    for c in contacts:
        p = c["properties"]
        lead, como = buscar(c, p)
        if not lead:
            continue
        matched += 1
        via[como] = via.get(como, 0) + 1
        hsid = c["id"]

        # Arbitraje de identidad. Por defecto manda HubSpot (D-008); solo se frena
        # cuando el dígito verificador del CUIL lo desmiente. Ver hubspot_refutado().
        salta_identidad = hubspot_refutado(lead, p)
        if salta_identidad:
            refutados.append((lead, norm_dni(lead.get("dni")), norm_dni(p.get("dni")), lead.get("cuil")))
        if p.get("cuil") and not cuil_valido(p.get("cuil")):
            cuil_roto.append((lead, p.get("cuil")))
        if lead.get("synced_hubspot_id") != hsid:
            links.append((lead["id"], lead["name"], hsid))

        # --- campos numéricos + situación: inequívocos, auto ---
        for col, prop, typ in IDENTITY + SITUACION:
            if col == "phone":
                continue  # la llave; no la pisamos con ella misma
            if salta_identidad and col in ("dni", "cuil"):
                continue  # el CUIL desmiente a HubSpot: no se pisa el dato bueno
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

        # --- nombre: capitalizado + gate de confianza ---
        # Se capitaliza SIEMPRE al escribir. Un diff que es solo de mayúsculas
        # ('caso'→'Caso') pasa el gate (mismos tokens) → arregla las minúsculas de HS.
        hf, hl = titlecase(p.get("firstname")), titlecase(p.get("lastname"))
        sb_full = f"{lead['name'] or ''} {lead['apellido'] or ''}".strip()
        hs_full = f"{hf or ''} {hl or ''}".strip()
        if hs_full and hs_full != sb_full:
            approved = lead["id"] in APPROVED_NAMES
            if approved or name_conf(lead["name"], lead["apellido"], hf, hl):
                if hf and titlecase(lead["name"]) != hf and (lead["name"] or "") != hf:
                    auto_changes.append((lead, "name", lead["name"], hf,
                                         "nombre-aprobado" if approved else "nombre-alta-conf"))
                if hl and (lead["apellido"] or "") != hl:
                    auto_changes.append((lead, "apellido", lead["apellido"], hl,
                                         "nombre-aprobado" if approved else "nombre-alta-conf"))
            else:
                review_rows.append([lead["id"], sb_full, hs_full, p.get("phone"), c["id"]])

    print("matcheados: " + " · ".join(f"{k} {v}" for k, v in via.items() if k)
          + f"   →  {matched}/{len(leads)}   ·   vínculos nuevos: {len(links)}")
    if refutados:
        print(f"\n⚠️  {len(refutados)} con el DNI de HubSpot REFUTADO por el CUIL — NO se pisan,")
        print("    y hay que corregirlos del lado de HubSpot:")
        for l, sd, hd, cu in refutados:
            print(f"    {(str(l['name'] or '')+' '+str(l['apellido'] or '')).strip()[:30]:32}"
                  f" Supabase {sd}  ·  HubSpot {hd}  ·  cuil {cu}")
    if cuil_roto:
        print(f"\n⚠️  {len(cuil_roto)} CUIL en HubSpot con dígito verificador inválido "
              f"(se escriben igual; confirmar en la llamada):")
        for l, cu in cuil_roto[:15]:
            print(f"    {(str(l['name'] or '')+' '+str(l['apellido'] or '')).strip()[:30]:32} {cu}")
        if len(cuil_roto) > 15:
            print(f"    … y {len(cuil_roto)-15} más")
    print()
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

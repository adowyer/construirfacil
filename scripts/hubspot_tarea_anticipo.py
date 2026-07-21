#!/usr/bin/env python3
"""
hubspot_tarea_anticipo.py — Tarea en HubSpot: "¿tiene anticipo?" para los que no tienen legajo.

POR QUÉ EXISTE (D-009)
  El Legajo Nro. necesita `has_lot` Y `has_anticipo` para saber su letra, y la letra
  no se inventa. Hoy hay 21 leads del sindicato a los que SOLO les falta `has_anticipo`:
  una pregunta de la asesora y el legajo sale solo.

  Sin una tarea, ese dato no lo pide nadie: no aparece en ninguna vista y la asesora
  no tiene forma de saber que falta. Una tarea SÍ tiene estado (pendiente/completada),
  vencimiento y responsable — a diferencia de una nota, que es texto muerto.

SEGURIDAD
  - DRY-RUN por defecto. Sin --write no crea nada.
  - No duplica: si el contacto ya tiene una tarea abierta con este asunto, la saltea.
  - NUNCA se agenda. Lo corre una persona.

USO
  python3 scripts/hubspot_tarea_anticipo.py            # dry-run
  python3 scripts/hubspot_tarea_anticipo.py --write

Stdlib only. NUNCA imprime tokens.
"""
import os, sys, json, datetime, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from push_legajo_to_hubspot import env, call, sb, norm_phone, norm_dni, tokens, name_key, hs_contacts

DRY = "--write" not in sys.argv
ASUNTO = "🗂️ Confirmar si tiene anticipo (falta para el Legajo)"
CUERPO = ("Para emitirle el Legajo Nro. falta UN solo dato: si cuenta con un anticipo.\n\n"
          "Preguntar en la llamada y cargar la respuesta en el campo «¿Tiene anticipo?» "
          "(ficha del contacto → 🏠 Ficha de créditos). Con eso alcanza: el legajo se "
          "emite solo, no hay que hacer nada más.\n\n"
          "Si además dice cuánto tiene, va en «💰 Monto del anticipo (ARS)» — pero el "
          "monto NO reemplaza al sí/no: hay gente que tiene anticipo sin saber cuánto.\n\n"
          "(El lote ya está confirmado en su ficha.)")


def match(l, by_id, by_phone, by_dni, by_name):
    """Misma escalera que push_legajo_to_hubspot: id → teléfono → DNI+nombre → nombre."""
    c = by_id.get(str(l.get("synced_hubspot_id") or ""))
    if c:
        return c, "id"
    cands = by_phone.get(norm_phone(l.get("phone")) or "", [])
    if len(cands) == 1:
        return cands[0], "teléfono"
    cands = by_dni.get(norm_dni(l.get("dni")) or "", [])
    if len(cands) == 1:
        cp = cands[0].get("properties") or {}
        if tokens(l.get("name"), l.get("apellido")) & tokens(cp.get("firstname"), cp.get("lastname")):
            return cands[0], "DNI+nombre"
    cands = by_name.get(name_key(l.get("name"), l.get("apellido")) or "", [])
    if len(cands) == 1:
        return cands[0], "nombre"
    return None, None


def tareas_abiertas(token, contact_ids):
    """IDs de contacto que YA tienen esta tarea (para no duplicar)."""
    ya = set()
    after = None
    while True:
        url = ("https://api.hubapi.com/crm/v3/objects/tasks?limit=100"
               "&properties=hs_task_subject,hs_task_status&associations=contacts"
               + (f"&after={after}" if after else ""))
        code, r = call(url, token)
        if code != 200:
            print(f"  ⚠️ no pude leer tareas ({code}) — sigo sin control de duplicados")
            return ya
        for t in r.get("results", []):
            if (t.get("properties") or {}).get("hs_task_subject") != ASUNTO:
                continue
            for a in ((t.get("associations") or {}).get("contacts") or {}).get("results", []):
                ya.add(str(a.get("id")))
        after = (r.get("paging") or {}).get("next", {}).get("after")
        if not after:
            return ya


def main():
    e = env()
    token, url, key = e.get("HUBSPOT_TOKEN"), e.get("SUPABASE_URL"), e.get("SUPABASE_SERVICE_KEY")
    if not (token and url and key):
        print("❌ faltan credenciales en .env"); sys.exit(1)

    print(f"\n{'DRY-RUN (no crea nada)' if DRY else '⚠️  MODO ESCRITURA'}\n")

    leads = sb(url, key,
               "leads?select=id,name,apellido,phone,dni,source,has_lot,has_anticipo,"
               "legajo_nro,synced_hubspot_id,engagement_sent_at"
               "&legajo_nro=is.null&has_anticipo=is.null&source=in.(sindicato_uocra,web_form)&limit=500")
    print(f"1. {len(leads)} leads sin legajo por falta de has_anticipo")

    contacts = hs_contacts(token)
    by_id = {c["id"]: c for c in contacts}
    by_phone, by_dni, by_name = {}, {}, {}
    for c in contacts:
        p = c.get("properties") or {}
        if norm_phone(p.get("phone")):
            by_phone.setdefault(norm_phone(p["phone"]), []).append(c)
        if norm_dni(p.get("dni")):
            by_dni.setdefault(norm_dni(p["dni"]), []).append(c)
        if name_key(p.get("firstname"), p.get("lastname")):
            by_name.setdefault(name_key(p.get("firstname"), p.get("lastname")), []).append(c)

    ya = tareas_abiertas(token, None)
    print(f"2. {len(contacts)} contactos en HubSpot · {len(ya)} ya tienen esta tarea")

    # Vence en 3 días hábiles-ish: da margen para agendar la llamada sin que nazca vencida.
    venc = datetime.datetime.now(datetime.timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0) \
           + datetime.timedelta(days=3)
    ts = int(venc.timestamp() * 1000)

    crear, sin_match, dup, ya_con_legajo = [], [], 0, []
    for l in leads:
        c, via = match(l, by_id, by_phone, by_dni, by_name)
        if not c:
            sin_match.append(l); continue
        # El contacto YA tiene legajo → la persona ya contestó lo del anticipo.
        # Pasa cuando el lead es una fila DUPLICADA (la misma persona cargada dos
        # veces: una por el formulario web y otra por la ficha del sindicato). La
        # fila duplicada no tiene has_lot, así que aparece como "falta el dato",
        # pero la persona real ya está resuelta. Preguntarle de nuevo sería
        # desprolijo — y sobre el contacto de su otra ficha, peor.
        if (c.get("properties") or {}).get("legajo_nro"):
            ya_con_legajo.append((l, c)); continue
        if c["id"] in ya:
            dup += 1; continue
        crear.append((l, c, via))

    print(f"\n3. Plan")
    print(f"  tareas a crear  : {len(crear)}")
    print(f"  ya la tenían    : {dup}")
    print(f"  sin match en HS : {len(sin_match)}")
    print(f"  ya tienen legajo: {len(ya_con_legajo)}  (filas duplicadas — la persona ya contestó)")
    for l, c in ya_con_legajo:
        print(f"    duplicado: {(l.get('name') or '')} {(l.get('apellido') or '')} → "
              f"{(c.get('properties') or {}).get('legajo_nro')}")
    for l, c, via in crear:
        nom = ((l.get("name") or "") + " " + (l.get("apellido") or "")).strip()
        print(f"    {nom[:32]:32} lote={str(l.get('has_lot')):5} "
              f"{'✉️ ya contactado' if l.get('engagement_sent_at') else ''}  ({via})")
    for l in sin_match:
        print(f"    sin match: {(l.get('name') or '')} {(l.get('apellido') or '')} {l.get('phone')}")

    if DRY:
        print("\n(dry-run — no se creó nada. Correr con --write para aplicar.)")
        return
    if not crear:
        print("\nNada que crear."); return

    print(f"\n4. Creando {len(crear)} tareas (vencen el {venc.date()})…")
    ok = err = 0
    for l, c, _ in crear:
        code, r = call("https://api.hubapi.com/crm/v3/objects/tasks", token, "POST", {
            "properties": {
                "hs_task_subject": ASUNTO,
                "hs_task_body": CUERPO,
                "hs_task_status": "NOT_STARTED",
                "hs_task_priority": "MEDIUM",
                "hs_task_type": "CALL",
                "hs_timestamp": ts,
            },
            "associations": [{
                "to": {"id": c["id"]},
                "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 204}],
            }],
        })
        if code in (200, 201):
            ok += 1
        else:
            err += 1
            print(f"  ❌ {(l.get('name') or '')}: {code} {str(r)[:200]}")
    print(f"\n✅ {ok} tareas creadas · {err} con error")


if __name__ == "__main__":
    main()

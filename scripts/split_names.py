#!/usr/bin/env python3
"""
split_names.py — separa nombre de pila y apellido en los leads del sindicato.

POR QUÉ EXISTE
Las fichas vinieron manuscritas y el OCR volcó el nombre completo dentro de
`leads.name`, dejando `leads.apellido` en null. Pero el ORDEN no es consistente:
en el mismo listado conviven "Silvana Gimenez" (nombre primero) y "Cortez Diego"
(apellido primero). No hay regla que sacar — se probó agrupar por `source_file` y
está mezclado adentro de cada uno.

Eso importa porque el saludo de WhatsApp toma el primer token: a "Sotelo Gabriel"
le escribiría "Hola Sotelo," — que no se lee como ConstruirFácil, se lee como una
gestora de cobranzas. Y el ratio de bloquear/reportar es lo que hunde el quality
rating del número.

El esquema ya estaba pensado bien: `sync_hubspot_to_supabase.py` arma el nombre
completo como `name + ' ' + apellido`, o sea `name` debía tener SOLO el nombre de
pila. Esto no agrega una columna: llena las que ya existen como fueron diseñadas.

CÓMO SE USA
    python3 scripts/split_names.py --review            # emite el CSV a revisar
    # ... Andrea corrige las columnas `nombre` y `apellido` en el CSV ...
    python3 scripts/split_names.py --apply             # dry-run: qué escribiría
    python3 scripts/split_names.py --apply --commit    # escribe (con backup antes)

EL LÉXICO NO DECIDE, PROPONE
La clasificación de tokens de abajo es una heurística, no una autoridad. Su único
trabajo es ordenar el CSV para que las filas dudosas queden arriba y las obvias
abajo. Toda fila con confianza != 'alta' espera revisión humana. Un token que no
está en ninguna lista NO se adivina: baja la confianza.
"""
import argparse
import csv
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CF = Path(__file__).resolve().parent.parent
REVIEW_CSV = CF / "tmp_nombres_a_revisar.csv"
BACKUP_DIR = CF / "tmp_backups"

# ── Léxico ────────────────────────────────────────────────────────────────────
# Construido sobre los 487 tokens distintos que aparecen en las 318 fichas del
# sindicato. Los ambiguos de verdad (que son nombre Y apellido usual en Argentina)
# quedan FUERA de las dos listas a propósito: bajan la confianza y van a revisión.

NOMBRES = """
Aaron Abel Abraham Abril Adelino Adiel Agustin Agustín Ailen Ailín Aimara Aixa
Alan Alba Alberto Aldo Alejandra Alejandro Alen Alex Alexander Alexis Alfredo
Alicia Alma Ana Anabel Anahi Anahí Andrea Andres Angel Angelica Anibal Antonio
Araceli Ariel Armando Arturo Augusto Axel Ayelen Aylen Bautista Bettina Brandon
Brenda Brian Brychan Carina Carla Carlos Carolina Cesar Claudia Claudio Cristian
Cynthia Damian Daniel Daniela Dardo Darian Dario Darían David Dayana Debora Denis
Deysi Diego Doris Edith Eduardo Eliana Elisabet Eliseo Emanuel Emilio Emmanuel
Enrique Enzo Ernesto Esteban Evangelina Evelin Evelio Exequiel Ezequiel Fabian
Fabio Fabiola Fabricio Facundo Fausto Federico Fernanda Fernando Fiorela Flavio
Florentino Franco Francisco Gabriel Gabriela Gaston Gerardo German Giselle
Graciela Griselda Guadalupe Guillermo Gustavo Hector Hugo Ignacio Isaias Isidoro
Ismael Israel Ivan Jair Javier Jazmin Jennifer Jeronimo Jesica Jessica Jesus Joan
Joel Johan Jonatan Jonathan Jorge Jose Josue Juan Julian Juliana Julio Karen
Kevin Lautaro Leandro Leonardo Leonel Lisi Liz Lorena Lorenzo Lucas Lucia Luciana
Luciano Ludmila Luis Macarena Manuel Marcela Marcelo Marcio Marco Marcos Margarita
Maria Mariela Marion Maris Marisa Marta Martin Martín Matias Mauricio Maximiliana
Maximiliano Mayra Melani Michel Miguel Milagros Milton Miqueas Mirta Nahir Nahuel
Nair Natali Natalia Nehemias Nerea Nestor Nicasio Nicolas Noelia Noemi Norberto
Omar Orlando Oscar Osvaldo Pablo Pamela Paola Patricia Patricio Perla Rafael Ramon
Ramón Raul Ricardo Roberto Rodrigo Roman Ruben Ruth Sady Samuel Santiago Santino
Sebastian Selena Sergio Silvana Soledad Stella Susana Suyay Tamara Tiago Tomas
Ulises Uriel Valentin Vanesa Verenice Veronica Verónica Vicente Violeta Virginia
Walter Wanda Yair Yamila Yanet
""".split()

APELLIDOS = """
Aburto Acevedo Aguayo Alarcon Alarcón Alcaraz Alfaro Allende Almanza Andrades
Arancibia Aravena Arguello Arias Arnez Baieli Balmaceda Bardaro Barriga Barros
Barroso Bayon Becerra Beltran Bianco Blasco Bogado Bolañuk Brito Busto Caballero
Cabrera Caitruz Calfuan Camacho Campillay Cardenas Carrasco Carrazana Carrillo
Carrizo Caso Castillo Castro Ceballos Centeno Cerda Chandia Chausino Choque Cides
Coliman Contreras Cordoba Coria Corneso Correa Cortez Cozzi Cruz Cuello Diaz
Dominguez Doncero Dorio Enriquez Erices Escobar Espina Espinola Espinoza Fernandez
Fernández Ferreyra Flor Flores Fonseca Frachi Freites Fuentes Galesi Gambarte
Garay Garcia Gimenez Giordano Gomez Gongo Gonzales Gonzalez Gosende Guajardo
Guatgua Guircako Guiñez Gutierrez Hasi Hernandez Huaman Ibañez Jacquez Jara Jorqui
Lagos Lastiri Lastra Lazza Leguizamon Leguizamón Leiva Llaveta Lopez Lucero Luengo
Luna Maciel Maidana Mamani Mancia Mansilla Martinez Matto Maximiec Mayorga Medina
Mendez Mendoza Meso Millacan Miranda Molina Mollo Montecino Montero Montes Montiel
Mora Morales Moreno Moya Moyano Mulbayer Muñoz Narvaez Nievas Olea Olgado Olivarez
Olivera Paladín Pando Paredes Pedemonte Peletay Perez Pérez Petricorena Pichun
Pincheira Pinto Ponce Porcheddu Quanta Quevedo Quezada Quintero Quiroga Quiroz
Rabanal Ramirez Ramos Reinoso Reyes Ricaldez Riela Rios Rivas Rivera Rivero Robles
Roca Roco Rodriguez Rojas Romero Rosales Rozzi Rubio Saez Salas Salvo Samaniego
Sanchez Sandoval Santander Saso Seguel Sepulveda Sepúlveda Serna Serrudo Silva
Solorza Sosa Sotelo Soto Suarez Suazo Tagliapietra Tara Toledano Torres Torrico
Urquiza Urrutia Valenzuela Vargas Vazquez Vega Velazquez Veloso Vera Viedma Vilche
Villalba Villarroel Villarrubia Villarruel Villegas Yañez Zapata Zelada Zumelzu
""".split()


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").strip().lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


SET_N = {fold(x) for x in NOMBRES}
SET_A = {fold(x) for x in APELLIDOS}
# Un token en las dos listas no aporta señal: que lo mire una persona.
AMBIGUOS = SET_N & SET_A
SET_N -= AMBIGUOS
SET_A -= AMBIGUOS


def clasificar(tok):
    f = fold(tok)
    if f in SET_N:
        return "N"
    if f in SET_A:
        return "A"
    return "?"


def proponer(name):
    """→ (nombre, apellido, confianza, patron). Nunca inventa: si no sabe, lo dice."""
    toks = (name or "").split()
    if not toks:
        return "", "", "baja", ""
    pat = "".join(clasificar(t) for t in toks)

    if "?" not in pat:
        # nombre(s) y después apellido(s)  → "Silvana Gimenez"
        if pat == "N" * pat.count("N") + "A" * pat.count("A") and "N" in pat and "A" in pat:
            k = pat.count("N")
            return " ".join(toks[:k]), " ".join(toks[k:]), "alta", pat
        # apellido(s) y después nombre(s)  → "Cortez Diego"
        if pat == "A" * pat.count("A") + "N" * pat.count("N") and "N" in pat and "A" in pat:
            k = pat.count("A")
            return " ".join(toks[k:]), " ".join(toks[:k]), "alta", pat
        # sólo nombres → falta el apellido en la ficha
        if set(pat) == {"N"}:
            return " ".join(toks), "", "falta_apellido", pat
        # sólo apellidos → falta el nombre, que es justo lo que necesita el saludo
        if set(pat) == {"A"}:
            return "", " ".join(toks), "falta_nombre", pat

    # intercalado ("Cristian Olivera Javier" = N A N) o con tokens desconocidos.
    # Se deja el primer token como nombre SÓLO para que el CSV tenga algo que
    # comparar; la confianza dice que no hay que creerle.
    return toks[0], " ".join(toks[1:]), "baja", pat


# ── Supabase ──────────────────────────────────────────────────────────────────
def load_env():
    e = {}
    for f in (".env", ".env.local"):
        p = CF / f
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            e.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    for k in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not e.get(k):
            sys.exit(f"FALTA {k} en .env / .env.local")
    return e


def sb(env, path, method="GET", body=None, prefer=None):
    h = {
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"],
        "Content-Type": "application/json",
        "User-Agent": "construirfacil-split-names/1.0",
    }
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/" + path, data=data, headers=h, method=method
    )
    try:
        raw = urllib.request.urlopen(req).read()
        return json.loads(raw) if raw else []
    except urllib.error.HTTPError as ex:
        sys.exit(f"Supabase {method} {path} → {ex.code}: {ex.read().decode()[:400]}")


def traer(env):
    return sb(
        env,
        "leads?select=id,name,apellido,phone,source_file,legajo_nro"
        "&source=eq.sindicato_uocra&name=not.is.null&order=source_file.asc&limit=2000",
    )


# ── Modos ─────────────────────────────────────────────────────────────────────
ORDEN = {"baja": 0, "falta_nombre": 1, "falta_apellido": 2, "ya_separado": 3, "alta": 4}


def cmd_review(env):
    leads = traer(env)
    filas = []
    for l in leads:
        if (l.get("apellido") or "").strip():
            # ya viene separado de antes: se propone tal cual, no se re-adivina
            filas.append((l, l["name"], l["apellido"], "ya_separado", ""))
            continue
        n, a, conf, pat = proponer(l["name"])
        filas.append((l, n, a, conf, pat))

    filas.sort(key=lambda f: (ORDEN[f[3]], (f[0].get("source_file") or "")))

    with open(REVIEW_CSV, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "name_ocr", "nombre", "apellido", "confianza", "patron",
                    "source_file", "phone", "legajo"])
        for l, n, a, conf, pat in filas:
            w.writerow([l["id"], l["name"], n, a, conf, pat,
                        l.get("source_file") or "", l.get("phone") or "",
                        l.get("legajo_nro") or ""])

    resumen = {}
    for _, _, _, conf, _ in filas:
        resumen[conf] = resumen.get(conf, 0) + 1
    print(f"{len(filas)} filas → {REVIEW_CSV.name}\n")
    for k in sorted(resumen, key=lambda x: ORDEN[x]):
        print(f"  {k:15} {resumen[k]:4}")
    revisar = sum(v for k, v in resumen.items() if k != "alta" and k != "ya_separado")
    print(f"\nA revisar a mano: {revisar}. El resto ya está arriba en el CSV.")
    print("Corregí las columnas `nombre` y `apellido`; el resto no se lee.")


def cmd_apply(env, commit):
    if not REVIEW_CSV.exists():
        sys.exit(f"No existe {REVIEW_CSV.name}. Corré --review primero.")
    actuales = {l["id"]: l for l in traer(env)}

    cambios, sin_nombre, intactos = [], [], 0
    with open(REVIEW_CSV, encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            lid = row["id"]
            cur = actuales.get(lid)
            if not cur:
                continue
            n, a = row["nombre"].strip(), row["apellido"].strip()
            if not n:
                sin_nombre.append((lid, row["name_ocr"]))
                continue
            if n == (cur.get("name") or "") and a == (cur.get("apellido") or ""):
                intactos += 1
                continue
            cambios.append((lid, cur.get("name"), cur.get("apellido"), n, a))

    print(f"sin cambio: {intactos} | a escribir: {len(cambios)} | sin nombre (se saltean): {len(sin_nombre)}")
    if sin_nombre:
        print("\n⚠️ Estas quedan como están — sin nombre de pila no hay saludo posible:")
        for lid, ocr in sin_nombre[:20]:
            print(f"    {lid}  '{ocr}'")
        if len(sin_nombre) > 20:
            print(f"    … y {len(sin_nombre) - 20} más")

    print("\nMuestra de lo que cambiaría:")
    for lid, on, oa, n, a in cambios[:15]:
        print(f"    '{on}' / '{oa or ''}'   →   nombre='{n}'  apellido='{a}'")

    if not commit:
        print(f"\n[dry-run] no se escribió nada. Para escribir: --apply --commit")
        return
    if not cambios:
        print("\nNada que escribir.")
        return

    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bak = BACKUP_DIR / f"leads_name_{stamp}.csv"
    with open(bak, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "name", "apellido"])
        for lid, on, oa, _, _ in cambios:
            w.writerow([lid, on, oa])
    print(f"\nBackup de los valores viejos → {bak}")

    ok = 0
    for lid, _, _, n, a in cambios:
        sb(env, f"leads?id=eq.{lid}", method="PATCH",
           body={"name": n, "apellido": a or None}, prefer="return=minimal")
        ok += 1
        if ok % 50 == 0:
            print(f"  {ok}/{len(cambios)}")
    print(f"\n✅ {ok} filas actualizadas.")
    print("⚠️ HubSpot no se toca acá. El nombre corregido viaja en el próximo "
          "reconcile_hubspot_sync.py.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--review", action="store_true", help="emite el CSV a revisar")
    g.add_argument("--apply", action="store_true", help="lee el CSV corregido y escribe")
    ap.add_argument("--commit", action="store_true", help="con --apply: escribe de verdad")
    args = ap.parse_args()
    env = load_env()
    if args.review:
        cmd_review(env)
    else:
        cmd_apply(env, args.commit)


if __name__ == "__main__":
    main()

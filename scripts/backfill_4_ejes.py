#!/usr/bin/env python3
"""
backfill_4_ejes.py — Backfill de los 4 ejes nuevos de tipología en house_catalog.
=============================================================================
Lee la planilla "Hausind Catalog Prices 250626.xlsx" (hoja SUPERFICIES COSTOS OK)
y un export CSV vivo de house_catalog, matchea por CLAVE ESTABLE
  (linea, nombre_comercial=style_name, variante, sistema)
y emite una migración de puros UPDATE que popula:
  circulacion  ← col "Tipología" (circulación) de la planilla
  morfologia   ← col "Tipología" (morfología) — BLOC/BLOCK normalizados a CUBO
  acceso       ← col "Acceso" — FRONTAL normalizado a "Frontal"
  area_social  ← col "A. Social" — capitalizado

Mismo patrón que `update_prices.py`: SKU es el destino del UPDATE pero NO la clave
de match (el SKU codifica área congelada). NO borra, NO inserta — sólo UPDATEs.

USO:
  python3 scripts/backfill_4_ejes.py \
    --sheet "docs/Hausind Catalog Prices 250626.xlsx" \
    --live  "INFO/house_catalog_live.csv" \
    --out   "supabase/migrations/0091_backfill_4_ejes_hausind.sql" \
    --emit

Sin --emit imprime sólo el reporte de cobertura. Con --emit escribe la migración.
"""
from __future__ import annotations
import csv, re, sys, argparse, unicodedata
from collections import Counter, defaultdict
from pathlib import Path
import openpyxl

SHEET_NAME = "SUPERFICIES COSTOS OK"

# Layout de la planilla 250626 — hoja SUPERFICIES COSTOS OK
COL = dict(
    linea=0, segmento=1,
    ex_tip=2,           # legacy U/O/Z/1/2/3
    morfo=3,            # DECK / BLOC / BLOCK / ZETA
    circ=4,             # EJES / NODO
    variante=5,
    acceso=6,           # FRONTAL / FLIP
    a_social=7,         # ANTERIOR / LATERAL / POSTERIOR
    nombre=8,           # NOMBRE COMERCIAL (LANIN, AMBA'Y I, …)
    estilo=9,           # categoría (Moderno, Nórdico, …)
    sistema=10,         # WOOD PLUS / STEEL PLUS / STONE PLUS
)

# Normalizaciones BLOC/BLOCK→CUBO, FRONTAL→Frontal. Todo lo demás se respeta.
MORFO_MAP  = {"BLOC": "CUBO", "BLOCK": "CUBO", "DECK": "DECK", "CUBO": "CUBO", "ZETA": "ZETA"}
ACCESO_MAP = {"FRONTAL": "Frontal", "LATERAL": "Lateral", "FLIP": "Flip"}
SOCIAL_MAP = {"ANTERIOR": "Anterior", "POSTERIOR": "Posterior", "LATERAL": "Lateral"}
CIRC_MAP   = {"EJES": "EJES", "NODO": "NODO"}


def deaccent(s: str) -> str:
    n = unicodedata.normalize("NFD", str(s))
    return "".join(c for c in n if unicodedata.category(c) != "Mn")


def norm_name(s) -> str:
    """Nombre de modelo: sin acentos, sin apóstrofos, sin espacios, sin sufijo romano."""
    if s is None:
        return ""
    n = deaccent(s)
    n = re.sub(r"['’`´]", "", n)
    n = re.sub(r"\s+", "", n).upper()
    n = re.sub(r"(III|II|I)$", "", n)
    return n


def norm_linea(s) -> str:
    if s is None:
        return ""
    return deaccent(s).upper().replace("LINEA", "").strip()


def norm_variante(v) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else str(v)
    s = str(v).strip().replace(",", ".")
    m = re.match(r"^(\d+)\.0+$", s)
    return m.group(1) if m else s


def norm_sistema(s) -> str:
    if s is None:
        return ""
    return str(s).strip().upper()


def norm_ex_tip(v) -> str:
    """EX Tipología legacy: U/O/Z (TERRA) o 1/2/3 (ATLAS/BOSQUE). Capta floats raros."""
    if v is None or v == "":
        return ""
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else str(v)
    return str(v).strip().upper()


def stable_key(linea, ex_tip, nombre, variante, sistema):
    """Clave de match: incluye EX Tipología (legacy 1/2/3/U/O/Z) para desambiguar
    casos donde dos modelos distintos comparten (linea, nombre, variante, sistema)."""
    return (norm_linea(linea), norm_ex_tip(ex_tip), norm_name(nombre),
            norm_variante(variante), norm_sistema(sistema))


def read_sheet(path: Path) -> dict[tuple, dict]:
    """
    Devuelve un dict keyed por stable_key → {circulacion, morfologia, acceso, area_social, _raw}.
    Si una key aparece varias veces con valores distintos, se loguea conflicto.
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[SHEET_NAME]
    by_key: dict[tuple, dict] = {}
    conflicts: list[tuple] = []
    skipped_empty = 0
    skipped_header = 0

    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row or not row[COL["linea"]]:
            skipped_empty += 1
            continue
        if str(row[COL["linea"]]).strip() == "LÍNEA COMERCIAL":
            skipped_header += 1
            continue
        # Filas "MÓDULOS" / agrupadoras: si no hay nombre comercial, salteo
        if not row[COL["nombre"]] or not row[COL["morfo"]]:
            skipped_empty += 1
            continue

        morfo_raw   = str(row[COL["morfo"]]).strip().upper()
        circ_raw    = str(row[COL["circ"]]).strip().upper() if row[COL["circ"]] else ""
        acceso_raw  = str(row[COL["acceso"]]).strip().upper() if row[COL["acceso"]] else ""
        social_raw  = str(row[COL["a_social"]]).strip().upper() if row[COL["a_social"]] else ""

        attrs = dict(
            circulacion=CIRC_MAP.get(circ_raw),
            morfologia=MORFO_MAP.get(morfo_raw),
            acceso=ACCESO_MAP.get(acceso_raw),
            area_social=SOCIAL_MAP.get(social_raw),
            _raw=dict(circ=circ_raw, morfo=morfo_raw, acc=acceso_raw, soc=social_raw,
                      linea=row[COL["linea"]], nombre=row[COL["nombre"]],
                      var=row[COL["variante"]], sistema=row[COL["sistema"]]),
        )

        key = stable_key(row[COL["linea"]], row[COL["ex_tip"]], row[COL["nombre"]],
                         row[COL["variante"]], row[COL["sistema"]])

        if key in by_key:
            prev = by_key[key]
            if any(prev[k] != attrs[k] for k in ("circulacion","morfologia","acceso","area_social")):
                conflicts.append((key, prev, attrs))
                continue
        by_key[key] = attrs

    return by_key, conflicts, skipped_empty, skipped_header


def read_live(path: Path) -> list[dict]:
    """Lee CSV vivo de house_catalog. Espera columnas linea, tipologia_code,
    variante, style_name, sistema_constructivo, sku."""
    rows = []
    with open(path, newline="") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            rows.append(r)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", required=True, type=Path)
    ap.add_argument("--live",  required=True, type=Path)
    ap.add_argument("--out",   required=False, type=Path,
                    default=Path("supabase/migrations/0091_backfill_4_ejes_hausind.sql"))
    ap.add_argument("--emit",  action="store_true", help="Escribir la migración SQL")
    args = ap.parse_args()

    print(f"📖 Leyendo planilla: {args.sheet}")
    sheet_idx, conflicts, sk_empty, sk_header = read_sheet(args.sheet)
    print(f"   {len(sheet_idx)} combinaciones únicas en la planilla")
    if conflicts:
        print(f"   ⚠️  {len(conflicts)} conflictos (misma key, ejes distintos):")
        for k, prev, new in conflicts[:5]:
            print(f"      key={k} prev={prev['_raw']} vs new={new['_raw']}")

    print(f"📖 Leyendo CSV vivo: {args.live}")
    live_rows = read_live(args.live)
    print(f"   {len(live_rows)} SKUs vivos en house_catalog")

    matched, unmatched_live = [], []
    sheet_keys_used: set[tuple] = set()

    for row in live_rows:
        key = stable_key(row["linea"], row["tipologia_code"], row["style_name"],
                         row["variante"], row["sistema_constructivo"])
        if key in sheet_idx:
            sheet_keys_used.add(key)
            attrs = sheet_idx[key]
            matched.append((row, attrs))
        else:
            unmatched_live.append(row)

    unmatched_sheet = {k: v for k, v in sheet_idx.items() if k not in sheet_keys_used}

    # Validar que ningún match tenga NULLs en los 4 ejes (debería estar todo cubierto)
    incomplete = [(r, a) for r, a in matched
                  if not all(a[k] for k in ("circulacion","morfologia","acceso","area_social"))]

    print()
    print("=== COBERTURA ===")
    print(f"  Matched              : {len(matched)} / {len(live_rows)} SKUs vivos")
    print(f"  Unmatched (live)     : {len(unmatched_live)}")
    print(f"  Unmatched (sheet)    : {len(unmatched_sheet)}")
    print(f"  Incomplete attrs     : {len(incomplete)}")
    print(f"  Conflictos planilla  : {len(conflicts)}")

    if unmatched_live:
        print()
        print("=== SKUs SIN MATCH EN PLANILLA (primeros 15) ===")
        for r in unmatched_live[:15]:
            print(f"  {r['sku']}  | {r['linea']} | {r['style_name']:<14} | V{r['variante']:<4} | {r['sistema_constructivo']}")

    if unmatched_sheet:
        print()
        print("=== FILAS PLANILLA SIN MATCH EN CATÁLOGO (primeras 15) ===")
        for k, v in list(unmatched_sheet.items())[:15]:
            r = v["_raw"]
            print(f"  {r['linea']} | {r['nombre']:<14} | V{r['var']!s:<4} | {r['sistema']}")

    if incomplete:
        print()
        print("=== MATCHES CON ATRIBUTOS NULOS (primeros 10) ===")
        for r, a in incomplete[:10]:
            null_axes = [k for k in ("circulacion","morfologia","acceso","area_social") if not a[k]]
            print(f"  {r['sku']}  null={null_axes}  raw={a['_raw']}")

    # Distribución de ejes en matched
    print()
    print("=== DISTRIBUCIÓN EJES (matched) ===")
    for eje in ("circulacion","morfologia","acceso","area_social"):
        c = Counter(a[eje] for _, a in matched)
        print(f"  {eje:<12}: {dict(c)}")

    if not args.emit:
        print()
        print("👉 Para escribir la migración: re-correr con --emit")
        return

    out_path: Path = args.out
    print()
    print(f"✍️  Escribiendo migración: {out_path}")

    sheet_name = args.sheet.name
    lines = [
        "-- =============================================================================",
        f"-- ConstruirFácil — Backfill 4 ejes de tipología desde planilla SH",
        f"-- Migration: {out_path.name}",
        "-- =============================================================================",
        f"-- Fuente: {sheet_name} (hoja {SHEET_NAME!r})",
        f"-- Generado por scripts/backfill_4_ejes.py",
        f"-- Match: (linea, nombre, variante, sistema) → 4 ejes",
        f"-- Normalización: BLOC/BLOCK → CUBO, FRONTAL → Frontal",
        f"-- Cobertura: {len(matched)} / {len(live_rows)} SKUs",
        "-- IDEMPOTENTE: UPDATE sólo cambia valores; volver a correr es no-op.",
        "-- =============================================================================",
        "",
        "begin;",
        "",
    ]
    for row, attrs in matched:
        sku = row["sku"].replace("'", "''")
        circ = attrs["circulacion"]
        morfo = attrs["morfologia"]
        acceso = attrs["acceso"]
        social = attrs["area_social"]
        sets = [
            f"circulacion = '{circ}'" if circ else "circulacion = null",
            f"morfologia  = '{morfo}'" if morfo else "morfologia  = null",
            f"acceso      = '{acceso}'" if acceso else "acceso      = null",
            f"area_social = '{social}'" if social else "area_social = null",
        ]
        lines.append(f"update public.house_catalog set {', '.join(sets)} where sku = '{sku}';")

    lines += [
        "",
        "commit;",
        "",
        "-- =============================================================================",
        "-- VERIFICACIÓN",
        "-- =============================================================================",
        "-- select circulacion, count(*) from public.house_catalog group by 1 order by 1;",
        "-- select morfologia,  count(*) from public.house_catalog group by 1 order by 1;",
        "-- select acceso,      count(*) from public.house_catalog group by 1 order by 1;",
        "-- select area_social, count(*) from public.house_catalog group by 1 order by 1;",
        "-- =============================================================================",
    ]
    out_path.write_text("\n".join(lines))
    print(f"   ✅ {len(matched)} UPDATEs emitidos")


if __name__ == "__main__":
    main()

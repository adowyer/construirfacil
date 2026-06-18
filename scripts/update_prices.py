#!/usr/bin/env python3
"""
update_prices.py — Pipeline OFICIAL de actualización de precios de house_catalog.
=============================================================================
Los precios de Hausind cambian seguido. Este script es el proceso CONOCIDO Y
SEGURO para actualizarlos: NO toca el admin, NO borra ni inserta filas, NO
re-genera SKUs. Emite una migración `fix_prices` de puros UPDATE por SKU.

POR QUÉ no se matchea por SKU directo:
  El SKU codifica el área (…-040) pero quedó CONGELADO cuando se actualizaron
  las áreas (la columna area_m2 cambió a 44.27 pero el SKU sigue diciendo 040).
  Por eso el match va por CLAVE ESTABLE = (linea, tipologia_code, variante,
  style_name, sistema) — sin área. El SKU se usa solo como destino del UPDATE.

ENTRADAS:
  1. La planilla de costos (hoja "SUPERFICIES COSTOS OK").
  2. Un export CSV vivo de house_catalog (select del README) — la verdad actual.
     Puede ser por línea (atlas/terra/bosque) y se corre el pipeline por cada uno.

SALIDA:
  - Migración SQL: ADD COLUMN costo_no_financiable_usd (idempotente) + UPDATEs.
  - Reporte de cobertura: matched / sheet-sin-match / db-sin-match / diff de precios.

USO:
  python3 scripts/update_prices.py \
    --sheet "INFO/Hausind Catalog Prices 100626.xlsx" \
    --live  "INFO/house_catalog_atlas_live.csv" \
    --out   "supabase/migrations/0069_fix_prices_hausind_100626.sql"
  (agregá --emit para escribir la migración; sin --emit es solo reporte)
"""
import csv, re, sys, argparse, unicodedata
from pathlib import Path
import openpyxl

SHEET_NAME = "SUPERFICIES COSTOS OK"
# Layout 0-indexed de la planilla 100626 (columnas agregadas vs el import de abril):
COL = dict(linea=0, seg=1, tipologia=2, variante=5, nombre=8, estilo=9, sistema=10,
           m2cub=12, costo_neto=20, no_financiable=21, precio_lista=23,
           precio_cupo=26, precio_pozo=29)

def deaccent(s):
    n = unicodedata.normalize('NFD', str(s))
    return ''.join(c for c in n if unicodedata.category(c) != 'Mn')

def norm_name(s):
    n = deaccent(s)
    n = re.sub(r"['’`´]", "", n)
    n = re.sub(r"\s+", "", n).upper()
    n = re.sub(r"(III|II|I)$", "", n)
    return n

def norm_linea(s):
    # 'LÍNEA ATLAS' -> 'ATLAS' ; 'ATLAS' -> 'ATLAS'
    return deaccent(s).upper().replace("LINEA", "").strip()

def norm_variante(v):
    if v is None: return None
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else str(v)
    s = str(v).strip().replace(',', '.')   # planilla usa coma decimal (0,1); DB usa punto (0.1)
    m = re.match(r"^(\d+)\.0+$", s)
    return m.group(1) if m else s

def norm_tip(v):
    if v is None: return None
    if isinstance(v, float): return str(int(v))
    return str(v).strip()

def stable_key(linea, tip, var, style, sistema):
    return (norm_linea(linea), norm_tip(tip), norm_variante(var),
            norm_name(style), str(sistema).strip().upper())

def num(v):
    if v in (None, '', '-'): return None
    if isinstance(v, (int, float)): return float(v)
    try: return float(str(v).replace(',', ''))
    except: return None

def read_live(path):
    by_key = {}
    with open(path, newline='') as f:
        for r in csv.DictReader(f):
            k = stable_key(r['linea'], r['tipologia_code'], r['variante'],
                           r['style_name'], r['sistema_constructivo'])
            by_key[k] = r
    return by_key

def read_sheet(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[SHEET_NAME]
    rows = list(ws.iter_rows(values_only=True))
    curr_linea = None
    out = {}
    for r in rows[2:]:
        if r is None: continue
        if isinstance(r[COL['linea']], str) and r[COL['linea']].strip() in ('BOSQUE', 'ATLAS', 'TERRA'):
            curr_linea = r[COL['linea']].strip()
        nombre = r[COL['nombre']]
        if not isinstance(nombre, str) or not nombre.strip(): continue
        if nombre.startswith(('LOTE', 'La siguiente')) or nombre in ('NOMBRE COMERCIAL', 'NOMBRE'): continue
        tip, var, sis, m2 = r[COL['tipologia']], r[COL['variante']], r[COL['sistema']], num(r[COL['m2cub']])
        if not (sis and m2 and tip is not None and var is not None): continue
        k = stable_key(curr_linea, tip, var, nombre, sis)
        rec = dict(key=k, lista=num(r[COL['precio_lista']]), cupo=num(r[COL['precio_cupo']]),
                   pozo=num(r[COL['precio_pozo']]), no_fin=num(r[COL['no_financiable']]), m2=m2)
        if k in out and out[k]['lista'] != rec['lista']:
            print(f"  ⚠ clave duplicada con precios distintos: {k}", file=sys.stderr)
        out[k] = rec
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--live', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--emit', action='store_true')
    a = ap.parse_args()

    live = read_live(a.live)
    sheet = read_sheet(a.sheet)

    matched, sheet_no_match, db_no_match = [], [], []
    for k, lr in live.items():
        if k in sheet:
            matched.append((k, lr, sheet[k]))
        else:
            db_no_match.append((k, lr))
    for k in sheet:
        if k not in live:
            sheet_no_match.append(k)

    print(f"live filas: {len(live)} | sheet filas: {len(sheet)}")
    print(f"  ✓ MATCH: {len(matched)}")
    print(f"  ⚠ en DB sin fila en planilla: {len(db_no_match)}")
    for k, lr in db_no_match[:10]: print(f"      {lr['sku']}")
    print(f"  ⚠ en planilla sin fila en DB (update-only: se ignoran): {len(sheet_no_match)}")

    # GUARD: el no_financiable es el 75% del costo_neto (= precio cupo/contado).
    # Caza el error de "fórmula no arrastrada" que ya nos mordió en Atlas.
    RATE = 0.75
    nf_bad = []
    for k, lr, sr in matched:
        base = sr['cupo']  # costo_neto = precio cupo de la planilla
        if base is None or sr['no_fin'] is None: continue
        expected = round(base * RATE, 2)
        if abs(sr['no_fin'] - expected) > 1.0:
            nf_bad.append((lr['sku'], sr['no_fin'], expected, base))
    if nf_bad:
        print(f"\n🔴 no_financiable ≠ 0.75×costo_neto en {len(nf_bad)} fila(s) — REVISAR la planilla:")
        for sku, got, exp, base in nf_bad[:20]:
            print(f"      {sku:32} planilla={got}  esperado={exp}  (cupo={base})")
    else:
        print(f"\n✓ no_financiable = 0.75×costo_neto OK en las {len(matched)} filas.")

    print("\nDIFF de precios (sku: lista viejo→nuevo | cupo | pozo | +no_fin):")
    changes = 0
    for k, lr, sr in sorted(matched, key=lambda x: x[1]['sku']):
        old_l = num(lr['precio_lista_usd']); new_l = sr['lista']
        if old_l != new_l: changes += 1
        if changes <= 12 and old_l != new_l:
            print(f"  {lr['sku']:32} {old_l}→{new_l} | {num(lr['precio_contado_usd'])}→{sr['cupo']} | "
                  f"{num(lr['precio_pozo_usd'])}→{sr['pozo']} | nf={sr['no_fin']}")
    print(f"  … modelos con cambio de lista: {changes}/{len(matched)}")

    if not a.emit:
        print("\n(solo reporte — agregá --emit para escribir la migración)")
        return

    lines = []
    lines.append("-- ===========================================================================")
    lines.append(f"-- fix_prices — actualización de precios house_catalog desde planilla")
    lines.append(f"-- Generado por scripts/update_prices.py (NO editar a mano; re-generar).")
    lines.append(f"-- Fuente planilla: {Path(a.sheet).name}  |  Live: {Path(a.live).name}")
    lines.append(f"-- Match por CLAVE ESTABLE (linea+tipologia+variante+style+sistema), SKU intacto.")
    lines.append(f"-- Solo UPDATE (sin delete/insert). {len(matched)} modelos.")
    lines.append("-- ===========================================================================")
    lines.append("begin;")
    lines.append("")
    lines.append("alter table public.house_catalog")
    lines.append("  add column if not exists costo_no_financiable_usd numeric;")
    lines.append("comment on column public.house_catalog.costo_no_financiable_usd is")
    lines.append("  'Piso de obra que Hausind debe recuperar para construir sin perder. Importado de la planilla (col NO FINANCIABLE). El margen financiable = precio_tier - costo_no_financiable.';")
    lines.append("")
    for k, lr, sr in sorted(matched, key=lambda x: x[1]['sku']):
        sku = lr['sku'].replace("'", "''")
        def v(x): return 'null' if x is None else repr(round(x, 2))
        lines.append(f"update public.house_catalog set "
                     f"precio_lista_usd={v(sr['lista'])}, precio_contado_usd={v(sr['cupo'])}, "
                     f"precio_pozo_usd={v(sr['pozo'])}, costo_no_financiable_usd={v(sr['no_fin'])} "
                     f"where sku='{sku}';")
    lines.append("")
    lines.append("-- VERIFICACIÓN antes de commit:")
    lines.append("select count(*) filter (where costo_no_financiable_usd is not null) as con_no_fin,")
    lines.append("       count(*) as total from public.house_catalog where brand='HAUSIND';")
    lines.append("")
    lines.append("commit;")
    lines.append("-- rollback;  -- usar si algo no cuadra")
    Path(a.out).write_text("\n".join(lines) + "\n")
    print(f"\n✓ Migración escrita: {a.out}  ({len(matched)} UPDATEs)")

if __name__ == '__main__':
    main()

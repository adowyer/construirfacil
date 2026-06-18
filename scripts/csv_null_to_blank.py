#!/usr/bin/env python3
"""
Limpia un CSV reemplazando la palabra literal "null" (celda COMPLETA) por vacío,
para que HubSpot la importe como "sin valor" en vez de fallar en number/date/dropdown.

- Whole-cell only: 'null' / 'NULL' / 'Null' -> ''.  NO toca substrings (ej. un email
  o nombre que contenga 'null' queda intacto).
- Escribe una COPIA  <archivo>_clean.csv  (no pisa el original).
- No imprime contenido de celdas (PII-safe), solo cuenta.

USO:  python3 scripts/csv_null_to_blank.py /ruta/al/export.csv
"""
import csv, sys, os

if len(sys.argv) != 2:
    print("USO: python3 scripts/csv_null_to_blank.py /ruta/al/export.csv")
    sys.exit(1)

src = sys.argv[1]
base, ext = os.path.splitext(src)
dst = base + "_clean" + (ext or ".csv")

replaced = 0
with open(src, newline="", encoding="utf-8") as fin, \
     open(dst, "w", newline="", encoding="utf-8") as fout:
    r = csv.reader(fin)
    w = csv.writer(fout)
    for row in r:
        new = []
        for cell in row:
            if cell.strip().lower() == "null":
                new.append("")
                replaced += 1
            else:
                new.append(cell)
        w.writerow(new)

print(f"OK -> {dst}")
print(f"Celdas 'null' -> vacío: {replaced}")

#!/usr/bin/env python3
"""
test_send_whatsapp.py — candado de la normalización de teléfonos y nombres.

No toca la red ni la base: sólo funciones puras de send_whatsapp.py.

    python3 scripts/test_send_whatsapp.py

POR QUÉ EXISTE
La primera versión de `wa_number()` borraba el "15" que encontrara después del código
de área. Eso mutilaba todo número que tuviera un "15" ADENTRO: 11-3155-1775 quedaba
en 8 dígitos y se descartaba en silencio. Era chequear la palabra en vez del
constructo — el mismo patrón que ya rompió guards de idempotencia en este repo.

El bug NO se veía leyendo el código: se vio corriéndolo. Por eso el candado es este
archivo y no un comentario.

CANARIO: si dudás de que el test sirva, rompé `wa_number` a propósito (por ejemplo
sacando el `if len(d) == 12`) y confirmá que se pone rojo. Un test que sólo pasa a
verde después del fix no demostró nada.
"""
import importlib.util
import sys
from pathlib import Path

CF = Path(__file__).resolve().parent.parent


def load():
    spec = importlib.util.spec_from_file_location("s", CF / "scripts" / "send_whatsapp.py")
    m = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, ["test"]
    try:
        spec.loader.exec_module(m)
    finally:
        sys.argv = argv
    return m


TELEFONOS = [
    # entrada                 esperado          por qué está en la lista
    ("11 3155-1775",          "5491131551775",  "CABA con guion — el caso que rompía"),
    ("1131551775",            "5491131551775",  "pelado, 10 dígitos"),
    ("011 15 3155-1775",      "5491131551775",  "con 0 y con 15"),
    ("+54 9 11 3155 1775",    "5491131551775",  "internacional completo"),
    ("541131551775",          "5491131551775",  "con país, sin el 9"),
    ("5491131551775",         "5491131551775",  "ya normalizado (idempotente)"),
    ("299 579-7815",          "5492995797815",  "Neuquén, área de 3"),
    ("0299 15 5797815",       "5492995797815",  "Neuquén con 0 y 15"),
    ("2995797815",            "5492995797815",  "Neuquén pelado"),
    ("2995155797",            "5492995155797",  "⚠️ el '15' está DENTRO del abonado"),
    ("11 1515-1515",          "5491115151515",  "⚠️ hostil: puro 15"),
    ("35835294",              None,             "un DNI en el campo teléfono (caso real)"),
    ("",                      None,             "vacío"),
    (None,                    None,             "null"),
    ("12345",                 None,             "corto: mejor saltear que inventar"),
]

NOMBRES = [
    ("MARGARITA MATTO GRISELDA", "Margarita", "OCR en mayúsculas"),
    ("Ariel Gomez",              "Ariel",     "normal"),
    ("jara evelin",              "Jara",      "todo minúscula"),
    ("  Wanda  Zumelzu ",        "Wanda",     "espacios de sobra"),
    ("De la Fuente, Ana",        "De",        "apellido primero — sale raro, es conocido"),
    (None,                       None,        "null"),
    ("   ",                      None,        "sólo espacios"),
]


def main():
    m = load()
    fallas = 0

    print("── wa_number ──")
    for entrada, esperado, motivo in TELEFONOS:
        got = m.wa_number(entrada)
        ok = got == esperado
        fallas += 0 if ok else 1
        print(f"{'✅' if ok else '❌'} {str(entrada)!r:22} → {str(got):15} {motivo}")
        if not ok:
            print(f"    esperado: {esperado}")

    print("\n── first_name ──")
    for entrada, esperado, motivo in NOMBRES:
        got = m.first_name(entrada)
        ok = got == esperado
        fallas += 0 if ok else 1
        print(f"{'✅' if ok else '❌'} {str(entrada)!r:26} → {str(got):12} {motivo}")
        if not ok:
            print(f"    esperado: {esperado}")

    print()
    if fallas:
        sys.exit(f"❌ {fallas} fallas")
    print(f"✅ {len(TELEFONOS) + len(NOMBRES)} casos, sin fallas")


if __name__ == "__main__":
    main()

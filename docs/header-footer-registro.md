# Registro — Headers (3) + Footers (2)

Documento vivo. Cada ajuste de slide/contenido se registra en el changelog del final
(1 línea por cambio). El plan y las decisiones de arquitectura van arriba.

## Versiones

**Header (slider HeroRow):**
1. **CF B2C** — ruta `/`. Administra CF.
2. **CF B2B** — ruta `/empresas` (reemplaza la `LandingCF` vieja). Administra CF.
   Sembrado como copia del B2C, luego diverge. CTA "Ver Catálogo" → `/` (B2C abierto).
3. **Marca** — ruta `/catalogo/{slug}`. Administra la marca (portal self-service).

**Footer:**
1. **CF (b2c/b2b)** — administra CF (capa cierre + institucional).
2. **Marca** — administra la marca (sus `footer_card_content`).

## Modelo de datos

Tabla nueva `header_slide_content`:
`marca_id` (NULL = CF) · `variant` (`b2c`/`b2b`/null=marca) · `slide_key` ·
`is_cf_pinned` (bool) · textos (`eyebrow/title/subtitle/body/cta_label/cta_url`) ·
`image_url` · `sort_order` · `status` · `updated_at`.
UNIQUE `(marca_id, variant, slide_key)` NULLS NOT DISTINCT.

- **Editable = solo texto + foto.** Sin tamaño. Los *tipos* de slide quedan fijos en código.
- **Resolución** (aditiva, fallback al hardcoded actual = cero cambio visual hasta cargar):
  - B2C: `marca_id NULL, variant=b2c` + pinned.
  - B2B: `marca_id NULL, variant=b2b` (copia inicial de B2C) + pinned.
  - Marca X: `marca_id=X` ∪ slides `is_cf_pinned` (read-only para la marca).
- **2 slides CF-pinned** (presentes en todas las versiones, solo CF edita):
  - `principal` — "La casa que querés, en las condiciones que necesitás."
  - `pasos` — "4 simples pasos para acceder a tu nueva casa 100% financiada."

## Fases

| # | Fase | Estado |
|---|------|--------|
| 0 | Inventario de los 8 slides de HeroRow + clasificación + captura copy/foto actual | pendiente |
| 1 | Migración `0027_header_slide_content.sql` + bucket `header-images` + query resolución | pendiente |
| 2 | HeroRow ← DB (texto+foto por `slide_key`, fallback hardcoded) | pendiente |
| 3 | Admin CF `/admin/header` (selector B2C/B2B, form por slide, "Sembrar B2B desde B2C") | pendiente |
| 4 | Ruta B2B `/empresas` con `variant=b2b`; borrar `LandingCF` + `_archive/` (cierra task #7) | pendiente |
| 5 | Portal self-service marca: "Mi presentación" → editor de su header | pendiente |
| 6 | Footer: editor en portal (marca) + `/admin/footer` editable cierre/institucional (CF) | pendiente |

Defaults tomados: HomeRow (slider inferior) fuera de scope por ahora (eventual Fase 7);
"marca cerrada" = sin contenido cargado (sin gate nuevo); footer CF editable = cierre + institucional.

## Detalles encolados (independientes de las fases)

| ID | Detalle | Estado |
|----|---------|--------|
| **M1** | CRUD `marcas.iso_url` (isotipo, símbolo solo) **separado** de `logo_url` (isologo, lockup). Migración `0026 add column if not exists iso_url`. Uploader doble en CF (`/admin/marcas/[id]`) + portal (`/portal/settings`). **No se toca `logo_url` ni dónde se renderiza** — solo CRUD. Dónde se muestra cada uno = decisión de display aparte. | **hecho** — falta aplicar migración `0026` en Supabase |

## Changelog (slide por slide)

| Fecha | Versión | slide_key / ítem | Cambio | Quién |
|-------|---------|------------------|--------|-------|
| 2026-05-16 | — | — | Registro creado; plan acordado; M1 encolado | — |
| 2026-05-16 | marca | M1 iso_url | Implementado: mig 0026, `iso_url` en types, actions genéricas (isologo/isotipo) + guard admin\|dueño, `MarcaImageUploader` genérico + wrappers, uploaders en CF y portal. tsc 0, build OK. Pendiente aplicar 0026. | — |

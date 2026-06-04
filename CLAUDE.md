@AGENTS.md

# ConstruirFácil — KB del desarrollador (datos + dominio)

> **Propósito:** memoria del PROYECTO, no de una sesión. Cualquier IA que trabaje acá lo lee primero.
> Si descubrís un hecho durable, escribilo ACÁ, no solo en la memoria personal de un asistente.

## Qué es esto
**ConstruirFácil** (web Next.js) = catálogo/marketplace de constructoras de casas modulares. Marca
inicial con catálogo cargado: **Hausind**. Brand padre = ConstruirFácil; marcas viven en `public.marcas`
(renombrada de `constructoras` en migración 0003).

## DB compartida con Ximia (CRÍTICO)
La web **ConstruirFácil** y el **agente Ximia** (n8n, `~/Projects/XIMIA`) **comparten UNA sola base
Supabase** (`gvuzjbbgxefbtiuyxaoy.supabase.co`), acopladas por foreign keys.
- **Runtimes separados, esquema unificado.**
- **`supabase/migrations/` es el ÚNICO source of truth del esquema.** Todo cambio = migración numerada
  `NNNN_nombre.sql`, secuencial. **El founder corre el SQL a mano** en el SQL editor de Supabase.
- **Ximia/n8n NO hace DDL** — solo lee/escribe filas.
- Ver `XIMIA/CLAUDE.md` para el lado del agente.

## Estado del esquema (relevamiento 2026-05-31)
40 tablas públicas. 28 (catálogo/contenido/marketing) versionadas (migraciones 0001–0049). **12 tablas
del lado Ximia se habían creado ad-hoc fuera del repo** → recapturadas en
**`0050_baseline_ximia_tables.sql`** (`create table if not exists`, no-op contra la DB viva):
`users, projects, system_config, banks_financing, construction_quotas, financial_matrix,
private_financing_commitments, lots_inventory, conversations, messages, lead_qualification,
property_matches`. ⚠️ Estas 12 NO tienen RLS ni triggers hoy — pendiente review de seguridad.

## Capa geo / cupo — `0051_geo_layer_cupo_catalogo.sql` (aplicada + commiteada)
La **ubicación manda**: disponibilidad, cupo, financiación y precio dependen de la provincia.
- `construction_quotas`: +`marca_id`, +`provincia_id`, +`margin_pool_usd`, +`close_month`,
  `project_id` nullable, índice único de cohorte. **Cupo = por (marca × provincia). CUPO 0 = sin
  programa.** Seed: **Hausind × {neuquen, misiones} = 25/25** (pool 0, open, start 2026-06-01).
- `banks_financing` (7 líneas): +`provincia_id`, +`min_residency_years`, +`max_household_income_ars`,
  +`rci`. **Línea IPVU Neuquén:** residencia **5+ años**, ingreso familiar **< 6.5MM ARS**, rci 0.30,
  geo-gated. (rci: Hipotecario UVA & Personal Construcción 0.25; Nación 1ra/2da & Neuquén Única 1/2 0.30.)
- **Precios:** 3 por modelo → pozo < cupo/contado/base < lista. "Contado" = precio CUPO = base.
  Precio base nacional + ajustes zonales por marca en **`marca_zonas`** (migración 0047:
  `price_modifier_pct`, `extra_charge_amount`, `excluded` bool). **Disponibilidad = modelo de EXCLUSIÓN
  por marca** (default: todas las provincias). `provincias`/`marca_zonas`/`lineas` en 0002/0047.

## Hechos de dominio
- **Hausind tiene 3 líneas:** BOSQUE (premium), ATLAS (estándar), TERRA (la más chica/económica,
  open-concept). La planilla `INFO/Hausind Catalog Prices 220526.xlsx` solo tenía BOSQUE+ATLAS.
- Catálogo de casas vive en `house_catalog` (renombrada de la tabla de modelos previa).
- Condiciones financieras de origen: `INFO/Financiación_Bancaria.xlsx`.

## Convenciones
- Migraciones: `NNNN_nombre.sql`, secuencial. Nunca renumerar las existentes.
- Next.js: ver el bloque importado de `AGENTS.md` (versión con breaking changes; leer
  `node_modules/next/dist/docs/`).

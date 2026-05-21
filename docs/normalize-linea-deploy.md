# Runbook — Normalización de `linea` / `style_name`

Migración: `supabase/migrations/0023_normalize_linea_style_name.sql`.

La migración y los parches de código **deben desplegarse en la MISMA ventana**:
la migración sola rompe el catálogo (eyebrows "Línea Línea Bosque", agrupación
vacía, expandido 404). No aplicar una sin el otro.

> Hallazgo verificado contra el código actual: `house_catalog.style_name` HOY
> se guarda **sin acento** (`02_import_models.mjs:343` → `normalizeName`, que
> strip-ea diacríticos/apóstrofos en `:87-95`), mientras `model_content` los
> conserva (`0021` keya `'AMBA''Y'`/`'LANÍN'`). Por eso el join editorial de
> los 7 modelos con tilde (AMBA'Y, LANÍN, ALECRÍN, CAMBOATÁ, GUAYUBIRÁ, TIMBÓ,
> INGÁ) **ya está roto hoy** en el catálogo y en `/admin` (las fotos sí
> resuelven porque van por `model_image_skus.house_catalog_id`,
> accent-insensitive; el texto editorial no). La migración sube
> `house_catalog.style_name` a la forma acentuada para cerrarlo — esto es
> scope ampliado vs. el brief original (que solo mencionaba `model_images`):
> ver "Decisiones que necesitan OK".

## (a) Parches de código exactos (verificados en el árbol actual)

### CRÍTICO 1 — `lib/supabase/queries/catalog_grouped.ts:131-134` (`lineaTitleCase`)
Con `linea='LÍNEA BOSQUE'`, `displayLinea` → "Línea Línea bosque".

VIEJO:
```ts
export function lineaTitleCase(linea: string | null | undefined): string {
  if (!linea) return ''
  return linea[0].toUpperCase() + linea.slice(1).toLowerCase()
}
```
NUEVO (quita el prefijo 'LÍNEA '/'LINEA ' antes de title-case):
```ts
export function lineaTitleCase(linea: string | null | undefined): string {
  if (!linea) return ''
  const bare = linea.replace(/^\s*L[ÍI]NEA\s+/i, '').trim()
  return bare ? bare[0].toUpperCase() + bare.slice(1).toLowerCase() : ''
}
```
Así `displayLinea('LÍNEA BOSQUE')` = "Línea Bosque" y `lineaTitleCase` = "Bosque".

### CRÍTICO 2 — `lib/supabase/queries/catalog_grouped.ts:140-145` y `:389-404` (slug round-trip)
`groupSlug` arma el slug desde `row.linea`/`style_name` crudos; con
`linea='LÍNEA BOSQUE'` el regex `[^a-z0-9-]` borra la Í y el espacio →
`lneabosque-...`, y `getGroupDetail` (`parts[0].toUpperCase()` +
`.eq('linea', ...)`) deja de matchear → **expandido 404**. Idéntico problema al
acentuar `style_name` (el `'` de `AMBA'Y` se strip-ea y la reconstrucción a
`AMBAY` ya no matchea la columna acentuada). Hay que desacoplar el token del
slug del valor crudo.

VIEJO (`groupSlug`, l.140-145):
```ts
function groupSlug(linea: string, style_name: string, tipologia_code: string): string {
  return [linea, style_name, `t${tipologia_code}`]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
}
```
NUEVO:
```ts
function lineaToken(linea: string): string {
  const bare = (linea ?? '').replace(/^\s*L[ÍI]NEA\s+/i, '')
  return bare.normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function styleToken(style_name: string): string {
  return (style_name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '')
}
function groupSlug(linea: string, style_name: string, tipologia_code: string): string {
  return [lineaToken(linea), styleToken(style_name), `t${tipologia_code}`]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
}
```
`getGroupDetail` (l.389-404): el slug ya NO permite reconstruir el `linea`
canónico ni el `style_name` acentuado. Reemplazar el parseo + `.eq()` por
resolver vía `getGroupedCatalog` y tomar los valores canónicos del
`CatalogModel` cuyo `group_slug` coincide.

VIEJO (l.389-404):
```ts
const parts = group_slug.split('-')
const tipCode = parts[parts.length - 1].replace('t', '').toUpperCase()
const linea = parts[0].toUpperCase()
const style = parts.slice(1, -1).join('').toUpperCase()

const { data: rows } = await supabase
  .from('house_catalog')
  .select('*')
  .eq('linea', linea)
  .eq('style_name', style)
  .eq('tipologia_code', tipCode)
  .eq('status', 'active')
  .order('variante')

if (!rows?.length) return null
```
NUEVO:
```ts
const tipCode = group_slug.split('-').slice(-1)[0].replace(/^t/, '').toUpperCase()
const catalogAll = await getGroupedCatalog(supabase)
const target = catalogAll.find(m => m.group_slug === group_slug)
if (!target) return null

const { data: rows } = await supabase
  .from('house_catalog')
  .select('*')
  .eq('linea', target.linea)
  .eq('style_name', target.style_name)
  .eq('tipologia_code', target.tipologia_code)
  .eq('status', 'active')
  .order('variante')

if (!rows?.length) return null
```
Más abajo (l.453) ya hace `getGroupedCatalog(supabase, { linea })`; podés
pasar `target` y evitar la segunda llamada — opcional, no bloqueante.

### CRÍTICO 3 — `components/catalog/CatalogPage.tsx:88` (`LINE_ORDER`) + filtros
`m.linea` pasa a 'LÍNEA BOSQUE'; `LINE_ORDER` y los `=== 'BOSQUE'` quedan sin match.
- L.88   VIEJO `const LINE_ORDER = ['ATLAS', 'BOSQUE', 'TERRA']`
         NUEVO `const LINE_ORDER = ['LÍNEA ATLAS', 'LÍNEA BOSQUE', 'LÍNEA TERRA']`
- L.289-293 `LINEA_ICON_FALLBACK`: claves VIEJO `BOSQUE/ATLAS/TERRA` →
  NUEVO `'LÍNEA BOSQUE'/'LÍNEA ATLAS'/'LÍNEA TERRA'` (se indexa por
  `l.name.toUpperCase()` = 'LÍNEA BOSQUE' tras la migración).
- L.383  VIEJO `const bosque = models.filter((m) => m.linea === 'BOSQUE')`
         NUEVO `... m.linea === 'LÍNEA BOSQUE')`

(L.276 `m.linea === line` y L.342/324 `.toUpperCase()` quedan OK porque `line`
ahora es 'LÍNEA …' y los mapas se keyan con el mismo valor.)

### CRÍTICO 4 — `components/catalog/HeroRow.tsx:358-388` (`LINEAS[].dbKey`)
`dbKey` joinea con `taglineByName` (keyed por `lineas.name`, l.510-514) y
`modelosByLineaName`/`lineaPhotosByName` (keyed por `m.linea.toUpperCase()` /
`img.linea.toUpperCase()`). Todos pasan a 'LÍNEA …'.
- L.361 `dbKey: 'BOSQUE'`  → `dbKey: 'LÍNEA BOSQUE'`
- L.371 `dbKey: 'ATLAS'`   → `dbKey: 'LÍNEA ATLAS'`
- L.381 `dbKey: 'TERRA'`   → `dbKey: 'LÍNEA TERRA'`

(`name: 'Bosque'/'Atlas'/'Terra'` son labels de UI: dejar como están.)

### CRÍTICO 5 — `components/catalog/HeroSlider.tsx:289-290` (SlideLineas)
Matchea `line_content` por `linea.slug.toUpperCase()` ('BOSQUE') contra
`lc.linea`, que pasa a 'LÍNEA BOSQUE' → tarjeta sin subtítulo/body.

VIEJO:
```ts
const slugUpper = linea.slug.toUpperCase()
const content = lineContent.find(l => l.linea === slugUpper && !l.tipologia_code)
```
NUEVO (compara contra el `name` canónico de la línea; `slug` sigue intacto):
```ts
const slugUpper = linea.slug.toUpperCase()
const lineaName = linea.name?.toUpperCase().trim() ?? `LÍNEA ${slugUpper}`
const content = lineContent.find(
  l => (l.linea?.toUpperCase().trim() === lineaName) && !l.tipologia_code,
)
```
`LINE_FALLBACK` (l.273-277) y `LINE_OPTIONS` (l.6) se indexan por `slugUpper`
(sin prefijo) → quedan OK (slug NO se toca). No requieren cambio.

### CRÍTICO 6 — `components/catalog/ExpandedPanels.tsx:1208-1210` (`CANONICAL_SCS.preferredLinea`)
`photoForLinea(preferredLinea)` compara `m.linea?.toUpperCase().trim() === targetLinea`;
`m.linea` pasa a 'LÍNEA BOSQUE' → SC panel sin foto preferida (cae a pool).
- L.1208 `preferredLinea: 'BOSQUE'` → `'LÍNEA BOSQUE'`
- L.1209 `preferredLinea: 'ATLAS'`  → `'LÍNEA ATLAS'`
- L.1210 `preferredLinea: 'TERRA'`  → `'LÍNEA TERRA'`

(L.634/684/749/1587 `lc.linea === model.linea` y la key `${linea}::${style_name}`
quedan OK: model_content y house_catalog quedan ambos canónicos tras la migración.)

### CRÍTICO 7 — `components/catalog/ModelRow.tsx:196-206` (`LINEA_TO_PRIMARY_SC`)
`LINEA_TO_PRIMARY_SC[(linea ?? '').toUpperCase()]` con linea='LÍNEA BOSQUE'.
- L.197-199 claves VIEJO `BOSQUE/ATLAS/TERRA` →
  NUEVO `'LÍNEA BOSQUE'/'LÍNEA ATLAS'/'LÍNEA TERRA'`.

### Scripts (NO runtime de campaña — anotar para futuras re-corridas)
- `02_import_models.mjs:343` escribe `style_name: normalizeName(nombre)` (SIN
  acento) y `linea: currentLinea` ('BOSQUE'/'ATLAS'/'TERRA', sin prefijo).
  Re-correrlo re-introduce las formas viejas. Antes de re-importar: ajustar
  para que `linea` sea `'LÍNEA ' + currentLinea` y `style_name` use el mapa
  estático con-acento (no `normalizeName`). NO tocar para la campaña.
- `04_sync_drive_photos.mjs`: `folderToLinea` devuelve 'BOSQUE' sin prefijo;
  el match a SKUs usa `norm()` (accent-insensitive) → linkeo OK aun con DB
  acentuada, pero los TEXT `model_images.linea/.style_name` que inserta
  volverán a la forma vieja en una re-corrida. Mismo ajuste pendiente.

## (b) Orden de deploy (una sola ventana)

1. **FREEZE admin**: avisar a la dueña que NO edite Modelos ni Líneas durante
   la ventana (cada save de modelo dispara el trigger; cada save de línea
   reescribe `lineas.name` y `line_content`). Idealmente sin tráfico de admin.
2. **STAGING — PRE**: correr el bloque PRE del `.sql` (incluye el `select
   tgname … pg_trigger`). Confirmar que el trigger se llama
   `house_catalog_sync_denorm` (si difiere, ajustar el `disable/enable trigger`
   del `.sql` antes de aplicar) y que `linea` solo tiene variantes de
   ATLAS/BOSQUE/TERRA.
3. **STAGING — migración**: aplicar `0023_normalize_linea_style_name.sql`
   (transacción única).
4. **STAGING — código**: desplegar con los 7 parches.
5. **STAGING — checklist** SQL + UX (abajo). Si algo falla → rollback (d).
6. **PROD**: tomar snapshot/PITR inmediatamente antes; repetir 2→5 en la MISMA
   ventana (PRE, migración, deploy de código, checklist).
7. **Reabrir admin**. Pedir a la dueña que abra `/admin/lineas`, verifique que
   el campo "name" muestra "LÍNEA BOSQUE/ATLAS/TERRA" y **NO lo acorte** al
   guardar (`normalizeLineaName` = UPPER(trim) conserva el canónico si lo deja).

## (c) Checklists

**SQL post** (bloque POST del `.sql`):
- [ ] 1 sola forma de `linea` por tabla, ∈ {LÍNEA ATLAS/BOSQUE/TERRA} (+NULL).
- [ ] `lineas.slug` intacto (atlas/bosque/terra).
- [ ] 0 duplicados en `line_content` (marca_id, linea, tipologia_code).
- [ ] 0 duplicados en `model_content` (style_name, linea).
- [ ] `house_catalog.linea` == `lineas.name` para todo `linea_id` no nulo.
- [ ] 0 `style_name` en ALECRIN/AMBAY/CAMBOATA/GUAYUBIRA/INGA/TIMBO/LANIN (sin
      acento) en ninguna tabla.
- [ ] 0 modelos activos sin `model_content` (o solo los que legítimamente no
      tienen editorial — comparar contra la lista PRE).
- [ ] trigger `house_catalog_sync_denorm` habilitado (`tgenabled='O'`).

**UX (catálogo público)**:
- [ ] El catálogo agrupa y muestra las 3 líneas (no vacío).
- [ ] Eyebrows/tags dicen "Línea Bosque", NO "Línea Línea Bosque".
- [ ] Abrir un modelo: expandido carga (no 404), comparativo y paneles
      editoriales con texto (model_content/line_content resueltos).
- [ ] Modelos con tilde (AMBA'Y, LANÍN, ALECRÍN, CAMBOATÁ, GUAYUBIRÁ, TIMBÓ,
      INGÁ): paneles editoriales ahora SÍ cargan (estaban rotos antes).
- [ ] Hero: modal de línea abre con modelos + fotos (grid + marquee).
- [ ] HeroSlider SlideLineas: cada tarjeta con subtítulo/body de line_content.
- [ ] /admin: editar un modelo (guardar) y reabrir /catalogo → línea y modelo
      siguen íntegros, sin "Línea Línea", sin perder el grupo.

## (d) Rollback (si falla en STAGING)

- La migración es UNA transacción: si tira error, ROLLBACK automático y el
  trigger vuelve habilitado solo (DISABLE TRIGGER es transaccional). No queda
  estado a medias.
- Si el PRE muestra valores de `linea` fuera de ATLAS/BOSQUE/TERRA: NO aplicar;
  mapearlos a mano o ampliar el CASE primero.
- Si la migración pasó pero un parche de código está mal: revertir SOLO el
  deploy de código al commit anterior. **NO dejar prod con migración aplicada +
  código viejo** (renderiza "Línea Línea Bosque" + agrupación vacía + 404).
- **No hay down-migration**: el colapso de duplicados borra filas y la forma
  sin-acento original no es reconstruible de forma fiable. Revertir el esquema
  exige restaurar de snapshot/PITR previo a la ventana → por eso el snapshot
  antes de PROD es obligatorio.

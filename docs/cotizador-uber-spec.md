# Cotizador "Uber" + cuota derivada — spec depurado v1

**Concepto.** Selector estilo Uber (precio vs. tiempo) que elige el **precio
total**; la **cuota mensual se deriva** de ese total con los datos reales de
los bancos. Un solo flujo coherente. Hace match con el banner de campaña
("casa 100% financiada") y resuelve la puerta a `/cotizar`.

## Decisiones cerradas (no volver a discutir)

- Mostramos **precio ilustrativo** ("desde", por config y por tramo).
- La cuota se calcula sobre **`precio_lista_usd`** (no contado).
- Selector → precio total → cuota derivada (no son ideas que compiten: se
  componen; el titular sigue siendo la cuota).
- Cuota = amortización francesa sobre la tabla **`bank_financing`** (misma
  fuente que usa Ximia → el "desde" público nunca contradice la
  precalificación). Ancla del "desde": Banco Neuquén Vivienda Única 1
  (100%, 240m, 3,5% UVA — la cuota más baja).
- **UVA siempre visible**: cuota *inicial*, ajusta por inflación. Innegociable.
- El CTA del cotizador ("Reservá tu cupo / La quiero") → `/cotizar` → lead
  real con `campaign_slug` (cierra el embudo medible ya construido).
- Patrón **admin-driven** (como header/home/footer/campañas): tramos
  editables, no hardcodeados.

## Los 3 tramos

| Tramo | Plazo | Precio (Δ vs lista) | Cuota |
|---|---|---|---|
| Lo quiero ya | < 6 meses | **+25%** | desde $X/mes |
| Cupo (destacado) | 6 meses | **0% (base)** | desde $X/mes |
| Espera y ahorra (cupo grande, ej. 20 casas) | mayor | **−10%** | desde $X/mes |

Regla completa y cerrada. Editable en `pricing_tiers` (admin).

## Modelo de datos

- `pricing_tiers`: key, label, lead_time, modificador de precio (±% o
  multiplicador), orden, activo — editable en `/admin`.
- `marca_price_slot` (0041): por marca, nombra las 3 columnas de precio de
  `house_catalog` (label libre) y marca **cuál es el base** (`is_base`, uno
  por marca) — el precio sugerido que consume el cotizador. Degrada a
  `lista` si la marca no configuró. Editable en `/admin/precios`.
- Cálculo: precio del **slot base** de la marca (Hausind = `precio_lista_usd`,
  por SC) → modificador del tramo → total → USD a ARS a
  **T.C. de referencia fechado** → amortización francesa (`interest_rate`,
  `max_term_months` de `bank_financing`) → cuota inicial UVA.
- `cupo_status` (DB realtime futura): contador "faltan K / N reservadas".
  **Capa opcional**: si no está, los 3 tramos funcionan igual sin contador;
  se enchufa cuando exista. No bloquea el feature.

## Dónde vive

- **Banner de campaña / hero**: gancho "Tu casa desde $X/mes".
- **Card del listado**: "desde $X/mes" + chip "elegí tu plan".
- **Ficha (expand)**: selector Uber completo (3 tramos lado a lado) + cuota
  recalculada + caveats + CTA → `/cotizar`.

## Caveats / letra chica obligatoria (día uno)

Cuota inicial estimada en UVA (ajusta). "Desde" — el valor final depende de
la config (variante × SC × tipología) y de la precalificación. T.C. de
referencia fechado. Bancos con nombre → TNA/CFT/plazo/"sujeto a aprobación
crediticia". Validez del cupo. Redacta el equipo, valida legal.

## Inputs

1. ✅ Deltas: fast +25% · cupo 0% · espera y ahorra −10%.
2. ✅ `bank_financing` mismo Supabase (lectura server-side service-role).
3. ⏳ **T.C. de referencia USD→ARS**: lo carga el usuario en /admin
   (`pricing_config`). Hasta entonces la cuota DEGRADA (no se muestra) —
   sin números falsos.
4. ⏳ DB de cupo realtime: opcional v1 (degrada).

## Pipeline de precios (reemplaza el ex-A.2/sc_factor)

`house_catalog` guarda el precio REAL por SKU y por SC en 3 columnas
físicas (`precio_lista/contado/pozo_usd`). NO hay `sc_factor` ni columnas
derivadas: el SC ya es una fila propia con su precio. Se actualizan por
CSV en `/admin/precios` (`lib/pricing/price-import.ts`, core compartido por
el Server Action y cualquier script → sin divergencia):

- Una marca por import. Match: `linea·style_name·tipologia_code·variante·
  sistema_constructivo` (normalizado NFC/case/espacios), scopeado por
  `marca_id`.
- Dry-run (`buildImportPlan`) → preview (a actualizar / sin cambios / sin
  match / inválidas / duplicadas) → `applyImportPlan` (confirmar).
- Sólo escribe columnas de precio presentes; celda vacía no borra; claves
  repetidas no se aplican (ambiguas); SKUs no mencionados no se tocan.
- Botón "descargar precios actuales" = plantilla de arranque del proveedor.

**Regla temporal Hausind** (precios SC aún no diferenciados): WOOD = base
actual · STEEL = ×1,10 · HORMIGÓN = ×1,21, a los 3 precios. CSV generado:
`docs/hausind-prices-temp.csv` (248 SKUs). Se sube por el propio importador.

**Estado:** Fases A+B + Pipeline #31 + **Fase C** hechas. Migraciones
0040/0041 aplicadas por el usuario. Fase C: `lib/content/cotizador-data.ts`
(resolver server, ancla reducida sin filtrar bancos, baseSlotByMarca),
`components/catalog/CotizadorUber.tsx` (selector 3 tramos + cuota en vivo,
francés puro client-side, degrada sin número falso, caveat saneado, CTA →
/cotizar), estilos `cf-uber-*` en catalog.css, threading via loadHomeData →
`/` y `/casa-financiada`, integrado en la ficha (StationDatos del detail
overlay; cae al CTA viejo en /catalogo /empresas → cero regresión).
**Para ver la cuota REAL falta:** cargar T.C. en `/admin/cotizador` (sin él
degrada a propósito) + subir el CSV de precios por `/admin/precios` (si no
se hizo aún) para diferenciar por SC. Fase D = card "desde $X/mes" + banner
+ ExpandedPanels + CTA en más superficies. Pausa para revisión de diseño.

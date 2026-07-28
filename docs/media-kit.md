# ConstruirFácil — Media Kit 2026

Marketplace de casas industrializadas en Argentina. Audiencia calificada:
familias evaluando construir su casa, con lote propio o buscándolo,
consultando líneas de crédito nacionales y provinciales.

- **Sitio**: https://construirfacil.com
- **Ad server**: Google Ad Manager (creativos IAB estándar)
- **Serving**: SafeFrame, lazy load, size reservado (Core Web Vitals amistoso)
- **Formatos aceptados**: PNG / JPG / GIF animado (≤150 KB) / HTML5 responsive

---

## Inventario — referencia IAB + tamaño real en el sitio

Los tamaños IAB (970×250, 300×600, etc.) son la **referencia comercial** que
maneja el anunciante. En ConstruirFácil los slots se sirven en **medidas
reales** que respetan el layout del sitio (ancho del buscador = 1500 px,
alto del slider = 420 px). El anunciante entrega el creativo AL TAMAÑO
REAL, manteniendo la proporción del IAB original.

| Slot ID                   | IAB (referencia) | Real (ConstruirFácil) | Dispositivo | Posición                                                        |
| ------------------------- | ---------------- | --------------------- | ----------- | --------------------------------------------------------------- |
| `home_top`                | 970×250          | **1500×386**          | Desktop     | Billboard arriba del HeroRow (home general y home de marca)     |
| `catalog_top`             | 970×90           | **1500×139**          | Desktop     | Super-leaderboard arriba de los filtros del catálogo            |
| `hero_scroll_main`        | 300×600          | **210×420**           | Desktop     | Half-page skyscraper entre slides del scroll horizontal HeroRow |
| `hero_scroll_secondary`   | 160×600          | **112×420**           | Desktop     | Skyscraper secundario entre slides del scroll HeroRow           |
| `hero_scroll_half`        | 300×250          | **252×210**           | Desktop     | ½ altura entre slides del scroll HeroRow                        |
| `content_inline`          | 728×90           | **1200×148**          | Desktop     | Leaderboard entre grupos verticales del catálogo                |
| `mobile_sticky`           | 300×50           | 300×50 (nativo)       | Mobile      | Sticky bottom persistente                                       |
| `mobile_inline`           | 300×250          | 300×250 (nativo)      | Mobile      | Inline entre secciones del scroll                               |

**Cálculo**: los tamaños reales preservan la proporción del IAB. Ejemplo:
`home_top` es billboard IAB 970×250 (ratio 3.88:1). El ancho real del sitio
es 1500; el alto proporcional = 1500 × (250 / 970) = **386 px**. Idem para
los demás — así los banners quedan **alineados con el layout** en vez de
flotando en un slot chico y desbalanceado.

---

## Planes de contratación

### 🏆 Main Partner Nacional
Máxima cobertura: audiencia completa de ConstruirFácil, todas las provincias.
Recomendado para bancos, aseguradoras, corralones nacionales y proveedores
de servicios con footprint AR.

**Slots incluidos:**
- 970×250 en **Home general** (`home_top`)
- 970×90 en **Catálogo general** (`catalog_top`)
- 300×600 entre slides del scroll horizontal (`hero_scroll_main`)
- 300×250 en **mobile** (`mobile_inline`)

**Targeting**: sin filtro geográfico — se muestra en toda la Argentina.

---

### 🗺️ Socio Regional
Cobertura por provincia. Ideal para constructoras regionales, servicios
locales (transporte, montaje, hormigón), inmobiliarias y bancos provinciales.

**Slots incluidos:**
- 970×250 en **Home Local** (`home_top`, targeteado a la provincia)
- 970×90 en **Catálogo Local** (`catalog_top`, targeteado a la provincia)
- 970×250 en **Home del catálogo de una marca** (si el partner tiene marca)
- 300×600 en scroll horizontal local (`hero_scroll_main`)
- 160×600 ó 300×250 secundarios (`hero_scroll_secondary` / `hero_scroll_half`)
- 300×50 **mobile sticky** (`mobile_sticky`)

**Targeting**: por `provincia` (key-value en GAM). Ejemplos: neuquen, misiones,
salta, mendoza, etc.

---

### 🧱 Proveedor Estratégico
Cobertura por marca. Para proveedores exclusivos de una constructora del
marketplace (fabricante de aberturas, piso, sanitarios) que quieren estar
presentes en el catálogo de esa marca.

**Slots incluidos:**
- 300×250 ½ banners entre slides del catálogo de la marca (`hero_scroll_half`)
- 970×250 en Home del catálogo de la marca (`home_top`, targeteado a la marca)
- 300×50 **mobile sticky** (`mobile_sticky`)

**Targeting**: por `marca` (key-value en GAM). Ejemplo: hausind.

---

## Targeting keys disponibles en GAM

El sitio pasa 3 key-values en cada ad request:

- `page_type`: `home` / `catalog` / `model_detail`
- `provincia`: slug de la provincia activa del visitante (ej. `neuquen`)
- `marca`: slug de la marca del catálogo actual (ej. `hausind`), sólo si el
  visitante está adentro del catálogo de una marca específica

Los 3 planes se trafficean en GAM combinando estas keys con los tamaños del
inventario. Ejemplo: **Socio Regional Neuquén** = line item con targeting
`provincia=neuquen` sobre los slots `home_top`, `catalog_top`, `hero_scroll_main`,
`mobile_sticky`.

---

## Specs técnicas de creativos

- **Tamaños obligatorios**: los IAB del inventario (no aceptamos custom).
- **Peso máximo**: 150 KB por creativo estático; 400 KB HTML5.
- **Formatos**: PNG, JPG, GIF (max 15s loop), HTML5 (SafeFrame-compatible).
- **Click URL**: HTTPS obligatorio. UTMs a criterio del anunciante.
- **Landing**: no puede ser un modelo de otra constructora del marketplace
  (política de conflicto de interés).
- **Contenido**: sin ofertas prohibidas por Ley 25.326 (privacy), Ley 26.485
  (violencia de género), Ley 26.522 (audiovisual) ni contenido político.

## Reporting

Cada anunciante recibe acceso al dashboard de Google Ad Manager con:
- Impresiones servidas
- CTR
- Viewability (Active View)
- Breakdown por tamaño / posición / provincia

Sin reportes duplicados desde nuestro lado: la fuente de verdad es GAM.

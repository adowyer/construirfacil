/**
 * lib/ads/gpt.ts
 *
 * Wrapper mínimo sobre Google Publisher Tags (GPT) — el SDK JS de Google Ad
 * Manager. Trafficking, rotación, frequency capping, reporting, viewability:
 * todo lo maneja GAM afuera. Nuestro código sólo:
 *
 *   1. Carga `gpt.js` una sola vez (`loadGPT()` — no-op si ya cargado).
 *   2. Registra + muestra un slot (`defineAndDisplay(config)`).
 *   3. Destruye un slot al desmontar el componente (`destroySlot(divId)`).
 *   4. Setea targeting global (`setPageTargeting({provincia, marca, page_type})`).
 *
 * Kill-switch por env: si `NEXT_PUBLIC_GAM_NETWORK_ID` está vacía (no hay
 * cuenta GAM aprobada aún) el módulo entero es no-op. El sitio no carga GPT,
 * no reserva espacio para ads, no cambia visualmente. Cuando Andrea meta el
 * Network ID y trafficee line items, los slots se activan solos.
 *
 * Contract con GAM (docs/media-kit.md):
 *   - Ad unit path: `/${networkId}/${slotId}` (ej. `/12345678/home_top`).
 *   - Targeting keys: `page_type`, `provincia`, `marca`.
 */

export const GAM_NETWORK_ID = process.env.NEXT_PUBLIC_GAM_NETWORK_ID ?? ''

export const GAM_ENABLED = Boolean(GAM_NETWORK_ID)

export type AdSize = [number, number]

export type AdSlotConfig = {
  /** Identificador del slot en GAM. Debe matchear el ad unit trafficked
   *  (ej. `home_top`, `hero_scroll_main`). Ver docs/media-kit.md. */
  slotId: string
  /** Tamaños IAB aceptados por el slot. GAM elige uno según qué line items
   *  tienen creativos activos que caben. */
  sizes: AdSize[]
  /** ID del div contenedor. Debe coincidir con el `id` del `<div>` renderizado
   *  por `<AdSlot>` y ser único en la página. */
  divId: string
  /** Key-values opcionales, sumados a los de página. Útil para diferenciar
   *  variantes del mismo slot (ej. dos 300×600 en distintas posiciones). */
  targeting?: Record<string, string | string[]>
}

// Access global sin `any` explícito. GPT queda en window.googletag.
type GoogleTag = {
  cmd: Array<() => void>
  defineSlot: (
    adUnitPath: string,
    sizes: AdSize[],
    divId: string,
  ) => GoogleTagSlot | null
  destroySlots: (slots: GoogleTagSlot[]) => boolean
  display: (divId: string) => void
  enableServices: () => void
  pubads: () => {
    enableSingleRequest: () => void
    collapseEmptyDivs: () => void
    setTargeting: (key: string, value: string | string[]) => void
    getSlots: () => GoogleTagSlot[]
    enableLazyLoad: (config?: Record<string, number>) => void
  }
}

type GoogleTagSlot = {
  addService: (service: unknown) => GoogleTagSlot
  setTargeting: (key: string, value: string | string[]) => GoogleTagSlot
  getSlotElementId: () => string
}

function getGoogleTag(): GoogleTag | null {
  if (typeof window === 'undefined') return null
  const g = (window as unknown as { googletag?: GoogleTag }).googletag
  return g ?? null
}

let gptScriptQueued = false

/**
 * Carga el script `gpt.js` de Google Ad Manager y configura los servicios
 * base. Idempotente: llamarla N veces desde N `<AdSlot>` es no-op después
 * de la primera. No-op si no hay Network ID.
 */
export function loadGPT(): void {
  if (typeof window === 'undefined') return
  if (!GAM_ENABLED) return
  if (gptScriptQueued) return
  gptScriptQueued = true

  // Stub el api antes de cargar el script para que las llamadas `cmd.push`
  // que sucedan mientras el script carga se encolen correctamente.
  const w = window as unknown as { googletag?: GoogleTag }
  w.googletag = w.googletag ?? ({ cmd: [] } as unknown as GoogleTag)

  // El `<Script>` de app/layout.tsx ya trae `gpt.js` con
  // strategy="afterInteractive"; este loader sólo asegura la config de
  // servicios cuando el primer slot pide un display.
  const g = w.googletag!
  g.cmd.push(() => {
    const pubads = g.pubads()
    pubads.enableSingleRequest()
    pubads.collapseEmptyDivs()
    // Lazy load: no requestees el ad hasta que el div esté cerca del viewport.
    // fetchMargin=200% (~2 viewports antes), renderMargin=100% (~1 viewport
    // antes de estar visible). Ahorra requests y mejora Web Vitals.
    pubads.enableLazyLoad({
      fetchMarginPercent: 200,
      renderMarginPercent: 100,
      mobileScaling: 2.0,
    })
    g.enableServices()
  })
}

/**
 * Setea targeting global (aplicado a TODOS los slots definidos después).
 * Llamar una vez por página desde el layout / page component. Los slots
 * individuales pueden sumar targeting propio via `AdSlotConfig.targeting`.
 */
export function setPageTargeting(targeting: {
  page_type?: 'home' | 'catalog' | 'model_detail'
  provincia?: string | null
  marca?: string | null
}): void {
  if (!GAM_ENABLED) return
  const g = getGoogleTag()
  if (!g) return
  g.cmd.push(() => {
    const pubads = g.pubads()
    if (targeting.page_type) pubads.setTargeting('page_type', targeting.page_type)
    if (targeting.provincia) pubads.setTargeting('provincia', targeting.provincia)
    else pubads.setTargeting('provincia', [])
    if (targeting.marca) pubads.setTargeting('marca', targeting.marca)
    else pubads.setTargeting('marca', [])
  })
}

/**
 * Define un slot en GPT y dispara `display()`. Idempotente por `divId`: si
 * el mismo divId ya fue definido, GAM ignora el segundo `defineSlot`.
 */
export function defineAndDisplay(config: AdSlotConfig): void {
  if (!GAM_ENABLED) return
  const g = getGoogleTag()
  if (!g) return
  g.cmd.push(() => {
    const path = `/${GAM_NETWORK_ID}/${config.slotId}`
    const slot = g.defineSlot(path, config.sizes, config.divId)
    if (!slot) return
    slot.addService(g.pubads())
    if (config.targeting) {
      for (const [k, v] of Object.entries(config.targeting)) {
        slot.setTargeting(k, v)
      }
    }
    g.display(config.divId)
  })
}

/**
 * Destruye un slot y libera memoria/observers. Llamar en cleanup del
 * useEffect del `<AdSlot>` para que la próxima navegación no acumule
 * slots muertos que sigan pidiendo ads.
 */
export function destroySlot(divId: string): void {
  if (!GAM_ENABLED) return
  const g = getGoogleTag()
  if (!g) return
  g.cmd.push(() => {
    const slots = g.pubads().getSlots()
    const slot = slots.find((s) => s.getSlotElementId() === divId)
    if (slot) g.destroySlots([slot])
  })
}

'use client'

/**
 * components/providers/ProvinciaProvider.tsx
 *
 * Contexto global de provincia + bootstrap del modal de onboarding.
 *
 * Flujo SSR → client:
 *   1. Layout root extrae cookie + header geo (server) y pasa al provider:
 *        { initialProvinciaId, suggestedProvinciaId, allProvincias }
 *   2. Si `initialProvinciaId` está seteada (cookie viva) → usa esa, no muestra modal.
 *   3. Si NO hay cookie pero hay `suggestedProvinciaId` (geo header) → modal con
 *      "¿Estás en {NombreProvincia}?" para confirmar / cambiar.
 *   4. Si NO hay nada → modal pidiendo elegir.
 *
 * El modal puede saltarse con "Más tarde" (skipped flag en localStorage de
 * sesión para no molestar en la misma navegación).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  getProvinciaCookieClient,
  setProvinciaCookieClient,
} from '@/lib/cookies/provincia'
import type { ProvinciaRow } from '@/lib/supabase/queries/zones'
import { ProvinciaConfirmModal } from '@/components/onboarding/ProvinciaConfirmModal'

interface ProvinciaContextValue {
  provinciaId: string | null
  setProvinciaId: (id: string | null) => void
  provincias: ProvinciaRow[]
  /** Provincias donde NINGUNA marca recommendable opera (van al optgroup
   *  "Aún no operamos" en cualquier dropdown). */
  nonOperativeProvinciaIds: string[]
  /** Abre el modal manualmente (ej. desde un CTA "Cambiar zona"). */
  openProvinciaPicker: () => void
}

const Ctx = createContext<ProvinciaContextValue | null>(null)

const SKIP_SESSION_KEY = 'cf-provincia-skip-session'

export function ProvinciaProvider({
  children,
  initialProvinciaId,
  suggestedProvinciaId,
  provincias,
  nonOperativeProvinciaIds,
}: {
  children: ReactNode
  /** UUID. Si llega, NO se abre el modal de onboarding. */
  initialProvinciaId: string | null
  /** UUID sugerido por geo (Vercel header). Pre-llena el modal. */
  suggestedProvinciaId: string | null
  provincias: ProvinciaRow[]
  /** Provincias donde TODAS las marcas recommendable están excluidas.
   *  El modal las agrupa al final ("Aún no operamos ahí"). */
  nonOperativeProvinciaIds: string[]
}) {
  const [provinciaId, setProvinciaIdState] = useState<string | null>(
    initialProvinciaId,
  )
  const [modalOpen, setModalOpen] = useState(false)
  // Cuando el visitante cambia la provincia (vía StickyFilters / picker /
  // setProvinciaId imperativo) a una donde NO operamos, abrimos el modal
  // directamente en la vista waitlist sin volver a pasar por el picker.
  // Null = sin trigger pendiente.
  const [pendingWaitlistId, setPendingWaitlistId] = useState<string | null>(
    null,
  )
  const pathname = usePathname()

  // Onboarding ÚNICAMENTE en /catalogo (decisión del founder: home, landings y
  // /modelos/[slug] no deben interrumpir con un modal antes del primer scroll).
  // En el resto del sitio, el provider sigue activo (provee contexto a quien
  // lo pida) pero el modal no se dispara.
  const onboardingDisabled = !pathname?.startsWith('/catalogo')

  // Decisión de bootstrap en el primer mount client. Consolidado para evitar
  // flicker del modal cuando hay localStorage legacy pero no cookie todavía.
  useEffect(() => {
    if (provinciaId) return
    if (typeof window === 'undefined') return

    // Migración suave: si existe el localStorage histórico, lo levantamos
    // como cookie + estado (preserva la elección de usuarios pre-context).
    const legacy = window.localStorage.getItem('cf-provincia-id')
    if (legacy && provincias.some((p) => p.id === legacy)) {
      setProvinciaIdState(legacy)
      setProvinciaCookieClient(legacy)
      return
    }

    if (onboardingDisabled) return
    // Skip dentro de la misma sesión (cerrar con "Más tarde" no debería
    // re-abrir el modal al navegar). Persistencia en sessionStorage.
    if (window.sessionStorage.getItem(SKIP_SESSION_KEY) === '1') return
    setModalOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDisabled])

  const setProvinciaId = (id: string | null) => {
    // Detectamos CAMBIO real (no re-asignación al mismo valor) ANTES de
    // tocar el state — sino el chequeo non-op de abajo nunca distinguiría
    // "el modal me llamó con el id que ya tengo" de "el filtro cambió a otro".
    const isChange = id !== provinciaId
    setProvinciaIdState(id)
    setProvinciaCookieClient(id)
    // Mantengo localStorage en paridad por compat con CatalogPage actual.
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem('cf-provincia-id', id)
      else window.localStorage.removeItem('cf-provincia-id')
    }
    // Cambio a provincia no operativa → abrimos waitlist directamente.
    // Sin el guard isChange entraríamos en loop: el modal al cerrarse llama
    // setProvinciaId(samedId) → re-trigger → modal abre → loop.
    if (isChange && id && nonOperativeProvinciaIds.includes(id)) {
      setPendingWaitlistId(id)
      setModalOpen(true)
    }
  }

  const openProvinciaPicker = () => {
    setModalOpen(true)
  }

  const handleConfirm = (id: string) => {
    setProvinciaId(id)
    setModalOpen(false)
    setPendingWaitlistId(null)
  }

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SKIP_SESSION_KEY, '1')
    }
    setModalOpen(false)
    setPendingWaitlistId(null)
  }

  // Sincronía cross-tab: si otro tab cambia la cookie, este la levanta.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onFocus = () => {
      const cookieValue = getProvinciaCookieClient()
      if (cookieValue !== provinciaId) {
        setProvinciaIdState(cookieValue)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [provinciaId])

  return (
    <Ctx.Provider
      value={{
        provinciaId,
        setProvinciaId,
        provincias,
        nonOperativeProvinciaIds,
        openProvinciaPicker,
      }}
    >
      {children}
      {modalOpen && (
        <ProvinciaConfirmModal
          provincias={provincias}
          suggestedProvinciaId={suggestedProvinciaId}
          nonOperativeProvinciaIds={nonOperativeProvinciaIds}
          initialWaitlistProvinciaId={pendingWaitlistId}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
        />
      )}
    </Ctx.Provider>
  )
}

export function useProvincia(): ProvinciaContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Fallback graceful para árboles que renderizan fuera del provider
    // (ej. /admin). Devuelve un stub no-op para no romper el render.
    return {
      provinciaId: null,
      setProvinciaId: () => {},
      provincias: [],
      nonOperativeProvinciaIds: [],
      openProvinciaPicker: () => {},
    }
  }
  return ctx
}

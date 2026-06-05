'use client'

/**
 * lib/auth/use-client-identified.ts
 *
 * Hook que lee /api/client-status y devuelve si el visitante está
 * identificado (cookie cf_client o cf_session). Cachea el resultado en
 * un module-level state para que todos los componentes del árbol que lo
 * usen disparen 1 sola request por sesión.
 *
 * Para forzar refresh después de un cambio (ej. submitLead seteó cookie
 * nueva), usar `refetchClientStatus()`.
 */

import { useEffect, useState } from 'react'

export interface ClientStatus {
  identified: boolean
  source: 'verified' | 'lead' | null
  leadEmail: string | null
}

const DEFAULT_STATUS: ClientStatus = {
  identified: false,
  source: null,
  leadEmail: null,
}

let cached: ClientStatus | null = null
let inflight: Promise<ClientStatus> | null = null
const subscribers = new Set<(s: ClientStatus) => void>()

async function fetchStatus(): Promise<ClientStatus> {
  if (inflight) return inflight
  inflight = fetch('/api/client-status', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => j as ClientStatus)
    .catch(() => DEFAULT_STATUS)
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Fuerza re-fetch del status. Lo usa LeadForm post-submit para que el
 *  resto del UI se actualice (cookie nueva cf_session). */
export async function refetchClientStatus(): Promise<void> {
  cached = await fetchStatus()
  for (const cb of subscribers) cb(cached)
}

export function useClientIdentified(): ClientStatus {
  const [status, setStatus] = useState<ClientStatus>(cached ?? DEFAULT_STATUS)

  useEffect(() => {
    subscribers.add(setStatus)
    if (cached === null) {
      fetchStatus().then((s) => {
        cached = s
        for (const cb of subscribers) cb(s)
      })
    } else if (status !== cached) {
      setStatus(cached)
    }
    return () => {
      subscribers.delete(setStatus)
    }
  }, [status])

  return status
}

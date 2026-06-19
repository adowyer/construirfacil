'use client'

/**
 * Wrapper client-side del CatalogGate para el hard gate de /modelos/[slug].
 * Le provee un `onClose` que navega a la home del catálogo (en vez de cerrar
 * el modal y dejar al visitante sobre un teaser blureado sin escape).
 *
 * Prefetch de la home al montar: sin esto, el click en la X arrancaba un SSR
 * de "/" desde cero (page con force-dynamic) y el cierre se sentía pegoteado.
 * Con prefetch la transición es casi instantánea.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CatalogGate from './CatalogGate'

interface ModelGateClientProps {
  modelName: string
}

export default function ModelGateClient({ modelName }: ModelGateClientProps) {
  const router = useRouter()

  useEffect(() => {
    router.prefetch('/')
  }, [router])

  return (
    <CatalogGate
      context={{ modelName }}
      onClose={() => router.replace('/')}
    />
  )
}

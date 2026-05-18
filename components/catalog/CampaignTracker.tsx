'use client'

/**
 * components/catalog/CampaignTracker.tsx
 *
 * Dispara `landing_view` una vez al montar en la landing de campaña. El
 * server (/api/track) lee el path + query y persiste cf_camp/cf_utm/cf_sid
 * para atribuir los eventos siguientes (model_open, cotizar_open, lead).
 */

import { useEffect, useRef } from 'react'
import { track } from '@/lib/track/client'

export function CampaignTracker() {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track('landing_view')
  }, [])
  return null
}

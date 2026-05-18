'use client'

/**
 * components/admin/CampaignUtmGenerator.tsx
 *
 * Genera el link UTM-eado para entregar a cada medio. Taxonomía FIJA:
 *   utm_source  = el medio (input)            → comparás medios entre sí
 *   utm_medium  = display (editable)
 *   utm_campaign= la ola (estable, roll-up)   → suma todas las localidades
 *   utm_content = slug de la localidad (fijo) → comparás banners/localidades
 *   utm_term    = variante de creativo (opc.)
 * El contenido lo decide el PATH, no los UTM (sobreviven al stripping).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  buildCampaignUtmUrl,
  UTM_CAMPAIGN_DEFAULT,
} from '@/lib/supabase/queries/campaigns'

export function CampaignUtmGenerator({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState('')
  const [source, setSource] = useState('')
  const [medium, setMedium] = useState('display')
  const [campaign, setCampaign] = useState(UTM_CAMPAIGN_DEFAULT)
  const [term, setTerm] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const url = useMemo(
    () =>
      buildCampaignUtmUrl({
        origin: origin || 'https://construirfacil.com',
        slug,
        source: source || 'medio',
        medium,
        campaign,
        term,
      }),
    [origin, slug, source, medium, campaign, term],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard bloqueado: el input es seleccionable a mano */
    }
  }

  const fieldClass =
    'w-full border border-[#E8E8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff003d] focus:ring-2 focus:ring-[#ff003d]/10 transition-colors'
  const lbl =
    'block text-[11px] uppercase tracking-widest text-neutral-400 mb-1'

  return (
    <fieldset className="bg-white border border-[#E8E8E5] rounded-xl p-6">
      <legend className="text-[11px] uppercase tracking-widest text-neutral-400 px-2 -ml-2 mb-4">
        Generador de link por medio
      </legend>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl} htmlFor="utm-source">
            Medio <span className="text-neutral-300 normal-case">(utm_source)</span>
          </label>
          <input
            id="utm-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="lmneuquen"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="utm-term">
            Variante de creativo{' '}
            <span className="text-neutral-300 normal-case">(utm_term, opcional)</span>
          </label>
          <input
            id="utm-term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="banner-a"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="utm-campaign">
            Ola <span className="text-neutral-300 normal-case">(utm_campaign — estable)</span>
          </label>
          <input
            id="utm-campaign"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="utm-medium">
            Medium <span className="text-neutral-300 normal-case">(utm_medium)</span>
          </label>
          <input
            id="utm-medium"
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="mt-5">
        <label className={lbl}>Link para el medio</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className={`${fieldClass} font-mono text-xs bg-neutral-50`}
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 bg-[#ff003d] text-white px-[27px] py-[5px] rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-[#d80035] transition-colors"
          >
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          <code className="text-neutral-600">utm_content</code> = slug de la
          localidad (fijo, llave de atribución). El medio cambia
          <code className="text-neutral-600"> utm_source</code>; la ola se
          mantiene para sumar todas las localidades.
        </p>
      </div>
    </fieldset>
  )
}

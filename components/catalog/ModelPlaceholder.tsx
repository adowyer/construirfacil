/**
 * components/catalog/ModelPlaceholder.tsx
 *
 * CSS-gradient placeholder rendered when a house model has no real image.
 * The gradient is derived from the construction system and the gradient key
 * stored in mock data. Matches the visual language of the HTML mockup exactly.
 */

import type { GradientKey } from '@/lib/supabase/mock-data'

interface ModelPlaceholderProps {
  /** Gradient class key from mock data, e.g. 'ph-timbo2' */
  gradientKey: GradientKey | string
  /** Model name shown overlaid at bottom */
  name: string
  /** Optional CSS class for sizing */
  className?: string
  /** Show the name label overlay */
  showLabel?: boolean
}

export default function ModelPlaceholder({
  gradientKey,
  name,
  className = '',
  showLabel = true,
}: ModelPlaceholderProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Gradient background */}
      <div className={`absolute inset-0 ${gradientKey}`} />

      {/* Architectural grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Bottom gradient scrim */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
        }}
      />

      {/* Name label */}
      {showLabel && (
        <div
          className="absolute bottom-0 left-0 right-0 px-5 pb-4 z-10"
          style={{ fontFamily: 'var(--font-geist), sans-serif' }}
        >
          <p
            className="text-white font-black uppercase tracking-tight leading-none"
            style={{ fontSize: 'clamp(20px, 2.5vw, 32px)', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
          >
            {name}
          </p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'

export interface FeatureAutoSliderProps {
  items: { name: string; body: string }[]
  intervalMs?: number
  variant?: 'aside' | 'centered'
}

export default function FeatureAutoSlider({
  items,
  intervalMs = 3000,
  variant = 'aside',
}: FeatureAutoSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPaused || items.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [items.length, intervalMs, isPaused])

  // Reset animation when index changes
  useEffect(() => {
    if (progressRef.current) {
      const bars = progressRef.current.querySelectorAll('.cf-story-progress-fill')
      bars.forEach((bar) => {
        ;(bar as HTMLElement).style.animation = 'none'
        void (bar as HTMLElement).offsetWidth // trigger reflow
        ;(bar as HTMLElement).style.animation = ''
      })
    }
  }, [currentIndex])

  if (!items || items.length === 0) return null

  return (
    <div
      className={`cf-story-slider cf-story-slider-${variant}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {variant === 'aside' && (
        <div className="cf-story-progress-container" ref={progressRef}>
          {items.map((_, idx) => (
            <div
              key={idx}
              className="cf-story-progress-bar"
              onClick={() => setCurrentIndex(idx)}
            >
              <div
                className={`cf-story-progress-fill ${
                  idx === currentIndex ? 'active' : idx < currentIndex ? 'completed' : ''
                }`}
                style={{
                  animationDuration:
                    idx === currentIndex && !isPaused ? `${intervalMs}ms` : '0ms',
                  animationPlayState: isPaused ? 'paused' : 'running',
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="cf-story-content-wrapper">
        {items.map((item, idx) => (
          <div
            key={item.name}
            className={`cf-story-content ${idx === currentIndex ? 'active' : ''}`}
          >
            <h4 className="cf-story-title">{item.name}</h4>
            <p className="cf-story-body">{item.body}</p>
          </div>
        ))}
      </div>

      {variant === 'centered' && (
        <div className="cf-story-progress-container" ref={progressRef}>
          {items.map((_, idx) => (
            <div
              key={idx}
              className="cf-story-progress-bar"
              onClick={() => setCurrentIndex(idx)}
            >
              <div
                className={`cf-story-progress-fill ${
                  idx === currentIndex ? 'active' : idx < currentIndex ? 'completed' : ''
                }`}
                style={{
                  animationDuration:
                    idx === currentIndex && !isPaused ? `${intervalMs}ms` : '0ms',
                  animationPlayState: isPaused ? 'paused' : 'running',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

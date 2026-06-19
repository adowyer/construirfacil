'use client'

import styles from '../../app/ximia-lab/page.module.css'

// Mismo key que usa XimiaWidget — si cambia uno, cambiar el otro.
const STORAGE_KEY = 'cf_ximia_session_id'

export default function LabResetButton() {
  const handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // localStorage puede fallar en private mode — el reload igual fuerza nueva sessionId.
    }
    window.location.reload()
  }
  return (
    <button type="button" className={styles.resetButton} onClick={handleReset}>
      Empezar de nuevo
    </button>
  )
}

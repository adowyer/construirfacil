import type { Metadata } from 'next'
import styles from './page.module.css'

/**
 * Página de prueba aislada para Ximia. Reemplaza el lab anterior basado en
 * Botpress (`public/ximia-lab.html`). El widget se renderiza desde el layout
 * global — esta página solo provee el lienzo y el copy explicativo.
 *
 * URL canónica: /ximia-lab. La URL legacy /ximia-lab.html resuelve acá vía
 * `rewrites()` en next.config.ts (sin redirect — el host queda igual).
 */

export const metadata: Metadata = {
  title: 'Ximia · Lab',
  robots: { index: false, follow: false },
}

export default function XimiaLabPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Ximia · Lab</h1>
        <p className={styles.muted}>
          Página de prueba — no enlazada, <code>noindex</code>.<br />
          Abrí el chat desde el ícono arriba a la derecha.
        </p>
        <div className={styles.badge}>Widget propio · ConstruirFácil</div>
      </div>
    </main>
  )
}

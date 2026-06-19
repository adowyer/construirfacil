import type { Metadata } from 'next'
import styles from '../ximia-lab/page.module.css'

/**
 * Variante "real" del lab para mostrar Ximia con identidad verificada.
 * Mismo diseño que /ximia-lab — la diferencia es el pathname: el widget
 * solo entra en modo test cuando el pathname empieza con `/ximia-lab`, así
 * que acá el gate de OTP funciona normalmente (Ximia pide verificar mail
 * cuando llega al value moment).
 *
 * Comparte el CSS con ximia-lab a propósito: si cambia el lienzo, cambia
 * en ambos.
 */

export const metadata: Metadata = {
  title: 'Ximia · Lab',
  robots: { index: false, follow: false },
}

export default function XimiaDemoPage() {
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

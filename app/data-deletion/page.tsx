/**
 * app/data-deletion/page.tsx
 *
 * Página pública de instrucciones para eliminar los datos del usuario.
 * Requerida por Meta (Facebook Login) para apps en modo Live.
 *
 * Si en algún momento implementamos un endpoint POST de Data Deletion
 * Callback (signed_request), esta página queda como página informativa
 * pública apuntada desde el footer + página de privacidad.
 */

import type { Metadata } from 'next'

const SUPPORT_EMAIL = 'hola@construirfacil.com'

export const metadata: Metadata = {
  title: 'Eliminar mis datos · ConstruirFácil',
  description:
    'Instrucciones para solicitar la eliminación de tus datos personales en ConstruirFácil.',
}

export default function DataDeletionPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '80px 32px',
        fontFamily: '-apple-system, system-ui, sans-serif',
        color: '#0a0a0a',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 24 }}>
        Eliminar mis datos
      </h1>

      <p style={{ fontSize: 16, color: '#555', marginBottom: 32 }}>
        Si querés que eliminemos tu cuenta y todos los datos personales
        asociados (nombre, email, historial de navegación en el catálogo),
        seguí estos pasos:
      </p>

      <ol style={{ fontSize: 16, paddingLeft: 24, marginBottom: 40 }}>
        <li style={{ marginBottom: 16 }}>
          Mandanos un email a{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos`}
            style={{ color: '#ff003d', textDecoration: 'underline' }}
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          con el asunto <strong>&ldquo;Solicitud de eliminación de datos&rdquo;</strong>.
        </li>
        <li style={{ marginBottom: 16 }}>
          Indicá el email con el que te registraste (sea ConstruirFácil, Google
          o Facebook).
        </li>
        <li style={{ marginBottom: 16 }}>
          Procesamos tu solicitud dentro de los <strong>30 días</strong> hábiles.
          Recibirás un email confirmando la eliminación.
        </li>
      </ol>

      <div
        style={{
          background: '#f5f5f3',
          padding: '20px 24px',
          borderRadius: 8,
          fontSize: 14,
          color: '#666',
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>¿Qué eliminamos?</strong> Tu cuenta, tu email, tu nombre, tu
          historial de navegación en el catálogo y cualquier lead asociado.
          Conservamos información agregada y anónima (estadísticas de uso) que
          no permite identificarte.
        </p>
      </div>

      <p style={{ fontSize: 13, color: '#999', marginTop: 32 }}>
        Esta política rige también para usuarios que se registraron con Facebook
        Login. ConstruirFácil cumple con los requisitos de Meta sobre eliminación
        de datos del usuario.
      </p>
    </main>
  )
}

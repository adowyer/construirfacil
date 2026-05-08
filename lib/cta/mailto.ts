/**
 * lib/cta/mailto.ts
 *
 * Helper centralizado para los CTAs del catálogo público que abren un
 * mailto: pre-armado a cotizar@hausind.com.
 *
 * **Por qué mailto temporal:** los CTAs van a migrar al chat con Ximia
 * (asistente de IA) cuando esté listo. Mientras tanto, todos los CTAs del
 * sitio (modals del HeroRow, paneles del expandido, sticky CTA, footer)
 * resuelven a un mailto con cuerpo pre-armado y campos para que el usuario
 * complete sus datos.
 *
 * **Por qué centralizado:** cuando llegue Ximia hay una sola constante
 * (COTIZAR_EMAIL → función de Ximia) y un solo módulo para reemplazar.
 *
 * Tres flavors según el contexto:
 *
 * 1. **Cotización contextualizada** (Panel 10 Datos, sticky CTA, Panel 1
 *    Descripción): incluye modelo + variante + sistema en subject + body.
 *
 * 2. **Cotización genérica** (modals del HeroRow, mid-grid, footer):
 *    sin modelo específico; opcionalmente filtrada por línea.
 *
 * 3. **Hablar con un asesor** (exploración temprana, paneles educativos):
 *    consulta liviana sin compromiso de cotizar.
 */

export const COTIZAR_EMAIL = 'cotizar@hausind.com'

interface CotizarContext {
  /** Nombre comercial del modelo (ej. "Casa Amba'y"). Si está, el flavor
   *  es contextualizado; si falta, genérico. */
  modelName?: string
  /** Variante del SKU (ej. "1", "2", "3.1"). Solo se usa si hay modelName. */
  variante?: string | null
  /** Sistema constructivo elegido (ej. "WOOD PLUS"). Solo si hay modelName. */
  sistema?: string | null
  /** Línea (BOSQUE/ATLAS/TERRA). Para cotizaciones genéricas o si el user
   *  está explorando una línea entera sin un modelo específico. */
  linea?: string | null
}

interface AsesorContext {
  /** Línea de interés actual del usuario. Personaliza el subject + body. */
  linea?: string | null
}

function encodeMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Mailto para el CTA primario "Pedir cotización".
 * Si se pasa modelName: genera la versión contextualizada.
 * Si solo hay linea: genera versión genérica con la línea como pista.
 * Si no hay nada: genera versión completamente genérica.
 */
export function buildCotizarMailto(ctx: CotizarContext = {}): string {
  const subject = ctx.modelName
    ? `Cotización — ${ctx.modelName}`
    : 'Solicitud de cotización — ConstruirFácil'

  const lines: string[] = []

  if (ctx.modelName) {
    lines.push(`Hola, me interesa el modelo ${ctx.modelName}.`)
    if (ctx.variante) lines.push(`Variante: V${ctx.variante}`)
    if (ctx.sistema) lines.push(`Sistema constructivo: ${ctx.sistema}`)
    lines.push('')
  } else {
    lines.push('Hola, me gustaría recibir una cotización para mi futura casa.')
    lines.push('')
    if (ctx.linea) {
      lines.push(`Línea de interés: ${ctx.linea}`)
      lines.push('')
    }
  }

  lines.push('Mi nombre:')
  lines.push('Mi teléfono:')
  lines.push('Localidad / provincia:')
  lines.push('Cuándo planeo construir:')
  lines.push('')
  lines.push('Comentarios o preguntas:')
  lines.push('')

  return encodeMailto(COTIZAR_EMAIL, subject, lines.join('\n'))
}

/**
 * Mailto para el CTA secundario "Hablar con un asesor".
 * Más liviano que el de cotización: el user todavía está explorando y
 * solo quiere preguntar.
 */
export function buildAsesorMailto(ctx: AsesorContext = {}): string {
  const subject = ctx.linea
    ? `Consulta sobre línea ${ctx.linea} — ConstruirFácil`
    : 'Consulta general — ConstruirFácil'

  const lines: string[] = []
  lines.push('Hola, quería hacerles una consulta sobre las casas Hausind.')
  lines.push('')
  if (ctx.linea) {
    lines.push(`Estoy mirando la línea ${ctx.linea}.`)
    lines.push('')
  }
  lines.push('Mi nombre:')
  lines.push('Mi teléfono:')
  lines.push('Localidad / provincia:')
  lines.push('')
  lines.push('Mi consulta:')
  lines.push('')

  return encodeMailto(COTIZAR_EMAIL, subject, lines.join('\n'))
}

/**
 * lib/cta/whatsapp.ts
 *
 * WhatsApp como camino de conversión SECUNDARIO. El número va por env
 * (NEXT_PUBLIC_WHATSAPP_NUMBER, formato internacional sin + ni espacios,
 * ej. 5492995551234). VACÍO por defecto a propósito: NO hardcodear un
 * número de prueba — sería exactamente el CTA roto que hay que evitar.
 * Si está vacío, el botón NO se renderiza (mejor sin botón que uno muerto).
 *
 * El mensaje pre-cargado lleva la localidad para que ventas atribuya el
 * lead aunque entre por WhatsApp (señal secundaria al form, que es la
 * conversión medible primaria).
 */

export const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''
).replace(/[^0-9]/g, '')

export function buildWhatsappUrl(opts: {
  localidad?: string | null
  modelName?: string | null
}): string | null {
  if (!WHATSAPP_NUMBER) return null
  const lines = ['Hola, vengo de ConstruirFácil.']
  if (opts.modelName) lines.push(`Me interesa: ${opts.modelName}.`)
  if (opts.localidad) lines.push(`Localidad: ${opts.localidad}.`)
  lines.push('Quiero más información para construir mi casa.')
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    lines.join('\n'),
  )}`
}

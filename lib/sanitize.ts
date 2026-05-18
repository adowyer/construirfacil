/**
 * lib/sanitize.ts
 *
 * Saneo de HTML rich-text (server-only — sanitize-html usa Node). El saneo
 * es el BORDE de seguridad: toda escritura de body/long_body pasa por acá
 * (admin y portal actions), así lo guardado ya es seguro y el render puede
 * confiar (dangerouslySetInnerHTML). La marca escribe → sin esto = XSS.
 */

import sanitizeHtml from 'sanitize-html'

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'h3',
    'blockquote',
    'a',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    // Todo link externo: seguro por defecto.
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank',
    }),
  },
}

/** HTML rich-text saneado (subset seguro). '' si entra vacío/no-string. */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(String(html), OPTIONS).trim()
}

/**
 * Igual, pero devuelve NULL si no hay texto visible (ej. el editor manda
 * `<p></p>`). Mantiene el modelo "vacío → usa el default" del header.
 */
export function sanitizeRichTextOrNull(
  html: string | null | undefined,
): string | null {
  const clean = sanitizeRichText(html)
  if (!clean) return null
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, '')
    .replace(/\s/g, '')
  return text === '' ? null : clean
}

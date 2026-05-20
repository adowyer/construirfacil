/**
 * lib/content/rich.ts
 *
 * Helper para campos de contenido que migraron de textarea plano a WYSIWYG.
 * Antes guardábamos plain text con `\n\n` como párrafo y `\n` como salto;
 * ahora el admin guarda HTML (Tiptap). Para no romper filas viejas,
 * `ensureHtml` envuelve plain text en `<p>` + `<br>` y deja pasar HTML real.
 *
 * Se usa en server components que rendean `dangerouslySetInnerHTML` con
 * `cf-richtext` (estilos en app/catalog.css).
 */

const HTML_TAG_RE = /<[a-z][\s\S]*>/i

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function ensureHtml(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  if (HTML_TAG_RE.test(trimmed)) return trimmed
  return trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).split('\n').join('<br>')}</p>`)
    .join('')
}

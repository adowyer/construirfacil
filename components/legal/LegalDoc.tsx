/**
 * components/legal/LegalDoc.tsx
 *
 * Renderiza un documento legal en markdown (privacidad, términos) con
 * estilos sobrios. Server component — no usa JS en el cliente.
 *
 * Parser intencionalmente minimal: soporta headings, listas, hr, párrafos,
 * blockquotes, bold/italic/links/inline code. No soporta tablas, code
 * blocks ni imágenes — los docs legales no las necesitan.
 */

import type { ReactNode } from 'react'

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }

function parseBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/)
  const blocks: Block[] = []
  let i = 0

  const reHeading = /^(#{1,6})\s+(.+)$/
  const reHr = /^-{3,}\s*$/
  const reListItem = /^(\s*)([-*]|[a-z]\.|\d+\.)\s+(.+)$/i
  const reBlockquote = /^>\s?(.*)$/

  while (i < lines.length) {
    const line = lines[i]

    // Empty line → separator
    if (line.trim() === '') {
      i++
      continue
    }

    // Heading
    const h = reHeading.exec(line)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() })
      i++
      continue
    }

    // HR
    if (reHr.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // List
    const li = reListItem.exec(line)
    if (li) {
      const ordered = !/^[-*]$/.test(li[2])
      const items: string[] = [li[3]]
      i++
      while (i < lines.length) {
        const next = reListItem.exec(lines[i])
        if (!next) break
        items.push(next[3])
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // Blockquote
    const bq = reBlockquote.exec(line)
    if (bq) {
      const buf: string[] = [bq[1]]
      i++
      while (i < lines.length) {
        const next = reBlockquote.exec(lines[i])
        if (!next) break
        buf.push(next[1])
        i++
      }
      blocks.push({ type: 'blockquote', text: buf.join(' ').trim() })
      continue
    }

    // Paragraph — junta líneas consecutivas no-blank no-prefijo.
    const para: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]
      if (next.trim() === '') break
      if (reHeading.test(next)) break
      if (reHr.test(next)) break
      if (reListItem.test(next)) break
      if (reBlockquote.test(next)) break
      para.push(next)
      i++
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') })
  }

  return blocks
}

/**
 * Inline parser: procesa **bold**, *italic*, `code`, [text](url).
 * Devuelve nodos React. Es recursivo simple sin AST — orden de pasadas:
 * code → links → bold → italic. Suficiente para docs legales.
 */
function renderInline(text: string, keyPrefix = ''): ReactNode[] {
  const result: ReactNode[] = []
  let remaining = text
  let counter = 0

  // Tokenizer simple: en cada iteración, encuentra el match más cercano de
  // las patterns soportadas y lo extrae como nodo React. El texto restante
  // se sigue procesando.
  const patterns: {
    re: RegExp
    render: (m: RegExpExecArray, key: string) => ReactNode
  }[] = [
    {
      re: /`([^`]+)`/,
      render: (m, key) => <code key={key} className="cf-legal-code">{m[1]}</code>,
    },
    {
      re: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m, key) => (
        <a key={key} href={m[2]} className="cf-legal-link" target={m[2].startsWith('http') ? '_blank' : undefined} rel={m[2].startsWith('http') ? 'noopener noreferrer' : undefined}>
          {m[1]}
        </a>
      ),
    },
    {
      re: /\*\*([^*]+)\*\*/,
      render: (m, key) => <strong key={key}>{m[1]}</strong>,
    },
    {
      re: /\*([^*]+)\*/,
      render: (m, key) => <em key={key}>{m[1]}</em>,
    },
  ]

  while (remaining.length > 0) {
    let bestIdx = -1
    let bestMatch: RegExpExecArray | null = null
    let bestPattern: (typeof patterns)[number] | null = null

    for (const p of patterns) {
      const m = p.re.exec(remaining)
      if (m && (bestIdx === -1 || m.index < bestIdx)) {
        bestIdx = m.index
        bestMatch = m
        bestPattern = p
      }
    }

    if (!bestMatch || !bestPattern || bestIdx === -1) {
      result.push(remaining)
      break
    }

    if (bestIdx > 0) {
      result.push(remaining.slice(0, bestIdx))
    }
    result.push(bestPattern.render(bestMatch, `${keyPrefix}-${counter++}`))
    remaining = remaining.slice(bestIdx + bestMatch[0].length)
  }

  return result
}

function Block({ block, idx }: { block: Block; idx: number }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(block.level, 4)}` as 'h1' | 'h2' | 'h3' | 'h4'
      return (
        <Tag className={`cf-legal-h cf-legal-h${block.level}`}>
          {renderInline(block.text, `h-${idx}`)}
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p className="cf-legal-p">
          {renderInline(block.text, `p-${idx}`)}
        </p>
      )
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag className={`cf-legal-list cf-legal-list-${block.ordered ? 'ol' : 'ul'}`}>
          {block.items.map((it, j) => (
            <li key={j}>{renderInline(it, `li-${idx}-${j}`)}</li>
          ))}
        </Tag>
      )
    }
    case 'blockquote':
      return (
        <blockquote className="cf-legal-bq">
          {renderInline(block.text, `bq-${idx}`)}
        </blockquote>
      )
    case 'hr':
      return <hr className="cf-legal-hr" />
  }
}

export function LegalDoc({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown)
  return (
    <article className="cf-legal-doc">
      {blocks.map((b, i) => (
        <Block key={i} block={b} idx={i} />
      ))}
    </article>
  )
}

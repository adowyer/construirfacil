'use client'

/**
 * components/admin/RichTextEditor.tsx
 *
 * Editor WYSIWYG (Tiptap v3, StarterKit) para campos largos del header
 * (body / long_body). Escribe el HTML en un <input hidden name={name}> para
 * que el form (server action / FormData) lo levante sin más cambios.
 *
 * El saneo NO se hace acá: ocurre al guardar, server-side (lib/sanitize.ts),
 * que es el borde de seguridad. `immediatelyRender:false` = sin mismatch SSR.
 */

import { useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

interface Props {
  name: string
  initialHTML?: string | null
}

/** Detecta si el contenido ya viene como HTML (tiene tags); sino lo envolvemos
 *  como párrafos respetando saltos dobles (=párrafo) y simples (=<br>). Esto
 *  permite migrar campos que históricamente se guardaban como plain text sin
 *  perder los saltos al abrir el editor. */
function plainToHtml(raw: string): string {
  if (!raw) return ''
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  return raw
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${esc(para).split('\n').join('<br>')}</p>`)
    .join('')
}

function ToolbarBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
        active
          ? 'bg-[#ff003d] text-white border-[#ff003d]'
          : 'bg-white text-neutral-600 border-[#E8E8E5] hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1.5 border border-[#E8E8E5] border-b-0 rounded-t-lg px-2 py-2 bg-[#FAFAF8]">
      <ToolbarBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • Lista
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. Lista
      </ToolbarBtn>
      <ToolbarBtn
        active={false}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        Limpiar
      </ToolbarBtn>
    </div>
  )
}

export function RichTextEditor({ name, initialHTML }: Props) {
  const seeded = plainToHtml(initialHTML ?? '')
  const [html, setHtml] = useState<string>(seeded)

  const editor = useEditor({
    extensions: [StarterKit],
    content: seeded,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // Misma clase que el render del sitio → el editor muestra viñetas/
        // numeración/negrita igual (Tailwind resetea ul/ol; cf-richtext lo
        // restaura). Sin esto las listas se ven invisibles.
        class: 'cf-richtext min-h-[140px] px-3 py-2 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  })

  return (
    <div>
      {editor && <Toolbar editor={editor} />}
      <div className="border border-[#E8E8E5] rounded-b-lg focus-within:border-[#ff003d] focus-within:ring-2 focus-within:ring-[#ff003d]/10 transition-colors text-sm">
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  )
}

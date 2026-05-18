'use client'

/**
 * components/admin/AdminSidebar.tsx
 *
 * Sidebar del panel admin con highlight del item activo (usePathname) +
 * paleta CF (rojo accent en activo).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Library,
  Home as HomeIcon,
  FileText,
  Tag,
  PanelBottom,
  PanelTop,
  GalleryHorizontal,
  Layers,
  ScrollText,
  Megaphone,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

// Las secciones principales se renderean en orden, arriba.
const SECTIONS_TOP: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Catálogo',
    items: [
      { href: '/admin/marcas', label: 'Marcas', icon: Building2 },
      { href: '/admin/lineas', label: 'Líneas', icon: Library },
      { href: '/admin/models', label: 'Modelos', icon: HomeIcon },
    ],
  },
  {
    title: 'Contenido',
    items: [
      { href: '/admin/brand', label: 'Contenido del sitio', icon: FileText },
      { href: '/admin/sistemas', label: 'Sistemas constructivos', icon: Layers },
      { href: '/admin/header', label: 'Header', icon: PanelTop },
      { href: '/admin/home', label: 'HomeRow', icon: GalleryHorizontal },
      { href: '/admin/campanas', label: 'Campañas', icon: Megaphone },
      {
        href: '/admin/condiciones',
        label: 'Condiciones de entrega',
        icon: ScrollText,
      },
      { href: '/admin/footer', label: 'Footer cards', icon: PanelBottom },
    ],
  },
]

// "Configuración" va al fondo del sidebar (mt-auto), separada por un divider.
const SECTION_BOTTOM: { title: string; items: NavItem[] } = {
  title: 'Configuración',
  items: [{ href: '/admin/attributes', label: 'Atributos', icon: Tag }],
}

function isActive(pathname: string, href: string): boolean {
  // /admin solo matchea exacto; los demás matchean el prefix.
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

export function AdminSidebar() {
  const pathname = usePathname() ?? ''

  // Render reusable de un item de nav (idéntico para top y bottom).
  function renderItem(item: NavItem) {
    const Icon = item.icon
    const active = isActive(pathname, item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`relative px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-colors ${
          active
            ? 'bg-[#ff003d]/10 text-[#ff003d] font-semibold'
            : 'text-neutral-700 hover:bg-neutral-100 hover:text-black'
        }`}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ff003d] rounded-r-full"
          />
        )}
        <Icon
          className={`w-[18px] h-[18px] shrink-0 ${
            active ? 'text-[#ff003d]' : 'text-neutral-400'
          }`}
        />
        {item.label}
      </Link>
    )
  }

  return (
    <nav className="w-64 border-r border-neutral-200 bg-white py-6 px-4 flex flex-col shrink-0">
      <div className="flex flex-col gap-7">
        {SECTIONS_TOP.map((section, sIdx) => (
          <div key={section.title ?? `s-${sIdx}`} className="flex flex-col gap-1">
            {section.title && (
              <div className="px-3 mb-2 text-[10px] text-neutral-400 uppercase tracking-[0.18em] font-semibold">
                {section.title}
              </div>
            )}
            {section.items.map(renderItem)}
          </div>
        ))}
      </div>

      {/* Configuración pegada al fondo del sidebar */}
      <div className="mt-auto pt-6 border-t border-neutral-200 flex flex-col gap-1">
        <div className="px-3 mb-2 text-[10px] text-neutral-400 uppercase tracking-[0.18em] font-semibold">
          {SECTION_BOTTOM.title}
        </div>
        {SECTION_BOTTOM.items.map(renderItem)}
      </div>
    </nav>
  )
}

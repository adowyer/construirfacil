/**
 * lib/content/home-defaults.ts
 *
 * Fuente ÚNICA del HomeRow: estilos por slot (home-1..home-5, compartidos
 * b2c/b2b) + textos por slot/versión (los de LANDING_B2C/B2B actuales).
 * Lo usan HomeRow (render) y el editor admin/portal (prefill efectivo,
 * nunca vacío). Snapshot al guardar.
 */

import type {
  HomeSlide,
  HomeSlideKey,
  HomeVariant,
} from '@/lib/supabase/queries/home_content'

type StyleDefault = {
  bg: string
  image_url: string | null
  text_color: string
  body_color: string
  narrow: boolean
  cta_style: 'primary' | 'ghost' | 'none'
}

type TextDefault = {
  eyebrow: string
  label: string
  body: string
  cta_label: string | null
}

/** Visual por slot — compartido entre b2c y b2b (mismo ritmo del slider). */
export const HOME_STYLE_DEFAULTS: Record<HomeSlideKey, StyleDefault> = {
  'home-1': { bg: '#0a0a0a', image_url: null, text_color: '#ffffff', body_color: 'rgba(255,255,255,0.75)', narrow: true, cta_style: 'none' },
  'home-2': { bg: '#1a1a1a', image_url: '/home/4.jpeg', text_color: '#ffffff', body_color: 'rgba(255,255,255,0.88)', narrow: false, cta_style: 'none' },
  'home-3': { bg: '#969483', image_url: null, text_color: '#0a0a0a', body_color: '#2a2a2a', narrow: true, cta_style: 'none' },
  'home-4': { bg: '#ebe8df', image_url: null, text_color: '#0a0a0a', body_color: '#555555', narrow: true, cta_style: 'none' },
  'home-5': { bg: '#1a1a1a', image_url: '/home/1.jpeg', text_color: '#ffffff', body_color: 'rgba(255,255,255,0.9)', narrow: false, cta_style: 'primary' },
}

/** Texto por slot y versión (B2C / B2B), de LANDING_B2C / LANDING_B2B. */
export const HOME_TEXT_DEFAULTS: Record<
  HomeSlideKey,
  Record<HomeVariant, TextDefault>
> = {
  'home-1': {
    b2c: { eyebrow: 'Marketplace', label: 'Todo en Uno', cta_label: null, body: 'Elegí y comprá fácil. Explorá y compará cientos de diseños, modelos y tipos de casas de las mejores empresas, en un solo lugar. Compará presupuestos y encontrá tu casa ideal, con total transparencia.' },
    b2b: { eyebrow: 'Marketplace', label: 'Solución Total', cta_label: null, body: 'Un marketplace inteligente que conecta a miles de clientes y deriva leads a tu equipo, con la compra resuelta. Tráfico masivo, atención 24/7 y ventas listas. Mucho más que todo lo que ya conocías.' },
  },
  'home-2': {
    b2c: { eyebrow: 'Soporte', label: 'Atención 24/7', cta_label: null, body: 'Nuestro asistente inteligente online despeja todas tus dudas al instante, a cualquier hora. Una vez que encontrás tu casa ideal, arquitectos y asesores expertos toman la posta para ultimar los detalles.' },
    b2b: { eyebrow: 'Ximia.AI', label: 'Inteligencia Artificial', cta_label: null, body: 'Ximia.AI automatiza tu funnel y orquesta tu inventario en tiempo real. Una poderosa capa comercial y financiera que atiende la demanda para que tu equipo humano solo se enfoque en cerrar ventas.' },
  },
  'home-3': {
    b2c: { eyebrow: 'Confianza', label: 'Garantía Real', cta_label: null, body: 'En Construir Fácil seleccionamos rigurosamente constructoras y fabricantes de casas con capacidad y solvencia, para asegurarte que recibas tu casa en tiempo y forma, con la calidad que pagaste.' },
    b2b: { eyebrow: 'Tráfico', label: 'Tráfico Garantizado', cta_label: null, body: 'Impulsamos campañas de medios que llevan tráfico calificado a tu catálogo. Aseguramos un flujo constante de prospectos listos para convertir, maximizando el retorno de tu inversión publicitaria.' },
  },
  'home-4': {
    b2c: { eyebrow: 'Crédito', label: 'Financiación flexible', cta_label: null, body: 'Pre Calificamos tu perfil crediticio para conectarte con múltiples sistemas de financiación bancarios, privados o mixtos. Encontrá la cuota que podés pagar para empezar a construir hoy mismo.' },
    b2b: { eyebrow: 'Conversión', label: 'Catálogo Inteligente', cta_label: null, body: 'El carrito más avanzado del mercado. El catálogo de tu marca personaliza la oferta según la búsqueda de cada cliente, lo ayuda a elegir, y así acelera la decisión de compra y tu ciclo de venta.' },
  },
  'home-5': {
    b2c: { eyebrow: 'Catálogo', label: 'Elegí tu casa', cta_label: 'Ver catálogo', body: 'Navegá la vitrina más grande y avanzada del mercado. Filtrá por estilo, superficie o precio y descubrí la variedad de diseños de nuestras marcas asociadas. Tu nueva casa está a sólo un clic.' },
    b2b: { eyebrow: 'Acuerdos', label: 'Ahorro en Materiales', cta_label: 'Ver catálogo', body: 'Accedé a acuerdos exclusivos con marcas líderes de todo el mundo. Optimizá tus costos operativos mediante compras a escala y maximizá tus márgenes de ganancia.' },
  },
}

const txt = (a?: string | null, b?: string | null): string =>
  (a && a.trim()) || (b && b.trim()) || ''

export type EffectiveHomeSlide = {
  /** Clave React única (slot key, o id para banners repetibles). */
  key: string
  slide_key: HomeSlideKey | 'banner'
  /** Orden efectivo en el slider (fila → su sort_order; sin fila → índice natural del slot). */
  sort_order: number
  eyebrow: string
  label: string
  body: string
  cta_label: string
  cta_style: 'primary' | 'ghost' | 'none'
  bg: string
  image_url: string | null
  text_color: string
  body_color: string
  narrow: boolean
}

/** Slide efectivo para render: fila (campos no vacíos) sobre los defaults. */
export function effectiveHomeSlide(
  key: HomeSlideKey,
  variant: HomeVariant,
  row: HomeSlide | undefined,
  fallbackOrder: number,
): EffectiveHomeSlide {
  const S = HOME_STYLE_DEFAULTS[key]
  const T = HOME_TEXT_DEFAULTS[key][variant]
  return {
    key,
    slide_key: key,
    sort_order: row?.sort_order ?? fallbackOrder,
    eyebrow: txt(row?.eyebrow, T.eyebrow),
    label: txt(row?.label, T.label),
    body: txt(row?.body, T.body),
    cta_label: txt(row?.cta_label, T.cta_label) || 'Ver catálogo',
    cta_style: row?.cta_style ?? S.cta_style,
    bg: txt(row?.bg, S.bg),
    image_url: (row?.image_url && row.image_url.trim()) || S.image_url,
    text_color: txt(row?.text_color, S.text_color),
    body_color: txt(row?.body_color, S.body_color),
    narrow: row?.narrow ?? S.narrow,
  }
}

/**
 * Banner repetible del HomeRow (slide_key='banner'): sin slot default —
 * usa la fila con fallbacks fijos (dark + texto blanco), igual criterio
 * que el banner del header. Foto si image_url; si no, color de fondo.
 */
export function effectiveHomeBanner(row: HomeSlide): EffectiveHomeSlide {
  return {
    key: row.id,
    slide_key: 'banner',
    sort_order: row.sort_order ?? 100,
    eyebrow: txt(row.eyebrow),
    label: txt(row.label),
    body: txt(row.body),
    cta_label: txt(row.cta_label) || 'Ver catálogo',
    cta_style: row.cta_style ?? 'none',
    bg: txt(row.bg) || '#0a0a0a',
    image_url: (row.image_url && row.image_url.trim()) || null,
    text_color: txt(row.text_color) || '#ffffff',
    body_color: txt(row.body_color) || 'rgba(255,255,255,0.85)',
    narrow: row.narrow ?? false,
  }
}

/** defaultValues del editor (admin/portal): prefill efectivo, nunca vacío. */
export function homeEditorDefaults(
  key: HomeSlideKey,
  variant: HomeVariant,
  own: HomeSlide | null | undefined,
  inherited?: HomeSlide | null,
): Partial<HomeSlide> {
  const S = HOME_STYLE_DEFAULTS[key]
  const T = HOME_TEXT_DEFAULTS[key][variant]
  return {
    eyebrow: txt(own?.eyebrow, inherited?.eyebrow) || T.eyebrow,
    label: txt(own?.label, inherited?.label) || T.label,
    body: txt(own?.body, inherited?.body) || T.body,
    cta_label: txt(own?.cta_label, inherited?.cta_label) || (T.cta_label ?? ''),
    cta_url: txt(own?.cta_url, inherited?.cta_url),
    cta_style: own?.cta_style ?? inherited?.cta_style ?? S.cta_style,
    bg: txt(own?.bg, inherited?.bg) || S.bg,
    image_url: txt(own?.image_url, inherited?.image_url) || (S.image_url ?? ''),
    text_color: txt(own?.text_color, inherited?.text_color) || S.text_color,
    body_color: txt(own?.body_color, inherited?.body_color) || S.body_color,
    narrow: own?.narrow ?? inherited?.narrow ?? S.narrow,
    status: own?.status ?? 'active',
    sort_order: own?.sort_order ?? 0,
  }
}

/**
 * lib/content/landing-cf.ts
 *
 * Contenido de las landings ConstruirFácil: B2C (para compradores finales)
 * y B2B (para marcas/proveedores que quieran sumar su catálogo).
 *
 * Las dos versiones comparten el mismo componente `<LandingCF>` — solo cambia
 * el set de items, el título y los CTAs. Mantener acá la copy para que sea
 * fácil iterar sin tocar el render.
 */

export type LandingVariant = 'b2b' | 'b2c'

export interface LandingItem {
  /** id estable; el componente lo usa para track del item activo en hover/click */
  key: string
  /** label visible en el chevron del lado izquierdo */
  label: string
  /** cuerpo que aparece en el panel derecho al hover/tap */
  body: string
}

export interface LandingCta {
  label: string
  href: string
}

export interface LandingContent {
  variant: LandingVariant
  /** Título grande que se ve en el panel derecho cuando ningún item está activo */
  title: string
  items: LandingItem[]
  /** CTA principal (mailto para B2B "Sumá tu marca", link a /catalogo para B2C) */
  primaryCta: LandingCta
  /** CTA secundario (en B2B linkea al catálogo, en B2C no hay) */
  secondaryCta?: LandingCta
}

// Email de partners (alta de marca B2B). Apunta al inbox de ConstruirFácil
// ya configurado por el dueño — NO a cotizar@hausind.com, que es de una
// marca y desviaba los leads B2B cross-marca.
// TODO(user): cambiar a una casilla dedicada (ej. partners@construirfacil.com)
// cuando exista. Hoy info@ es el inbox general válido de ConstruirFácil.
const PARTNERS_EMAIL = 'info@construirfacil.com'

function partnersMailto(): string {
  const subject = 'Quiero sumar mi marca a ConstruirFácil'
  const body = [
    'Hola, soy parte del equipo de una marca de casas industrializadas y',
    'quiero conocer cómo sumar nuestro catálogo a ConstruirFácil.',
    '',
    'Marca:',
    'Mi nombre:',
    'Cargo:',
    'Teléfono:',
    'Sitio web:',
    '',
    'Comentarios:',
    '',
  ].join('\n')
  return `mailto:${PARTNERS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export const LANDING_B2C: LandingContent = {
  variant: 'b2c',
  title: 'La manera más inteligente y fácil de construir.',
  items: [
    {
      key: 'todo-en-uno',
      label: 'Todo en Uno',
      body: 'Elegí y comprá fácil. Explorá y compará cientos de diseños, modelos y tipos de casas de las mejores empresas, en un solo lugar. Compará presupuestos y encontrá tu casa ideal, con total transparencia.',
    },
    {
      key: 'atencion-24-7',
      label: 'Atención 24/7',
      body: 'Nuestro asistente inteligente online despeja todas tus dudas al instante, a cualquier hora. Una vez que encontrás tu casa ideal, arquitectos y asesores expertos toman la posta para ultimar los detalles.',
    },
    {
      key: 'garantia-real',
      label: 'Garantía Real',
      body: 'En Construir Fácil seleccionamos rigurosamente constructoras y fabricantes de casas con capacidad y solvencia, para asegurarte que recibas tu casa en tiempo y forma, con la calidad que pagaste.',
    },
    {
      key: 'financiacion',
      label: 'Financiación flexible',
      body: 'Pre Calificamos tu perfil crediticio para conectarte con múltiples sistemas de financiación bancarios, privados o mixtos. Encontrá la cuota que podés pagar para empezar a construir hoy mismo.',
    },
    {
      key: 'elegi-tu-casa',
      label: 'Elegí tu casa',
      body: 'Navegá la vitrina más grande y avanzada del mercado. Filtrá por estilo, superficie o precio y descubrí la variedad de diseños de nuestras marcas asociadas. Tu nueva casa está a sólo un clic.',
    },
  ],
  primaryCta: { label: 'Ver catálogo', href: '/catalogo' },
}

export const LANDING_B2B: LandingContent = {
  variant: 'b2b',
  title: 'La manera más inteligente y fácil de construir.',
  items: [
    {
      key: 'solucion-total',
      label: 'Solución Total',
      body: 'Un marketplace inteligente que conecta a miles de clientes y deriva leads a tu equipo, con la compra resuelta. Tráfico masivo, atención 24/7 y ventas listas. Mucho más que todo lo que ya conocías.',
    },
    {
      key: 'inteligencia-artificial',
      label: 'Inteligencia Artificial',
      body: 'Ximia.AI automatiza tu funnel y orquesta tu inventario en tiempo real. Una poderosa capa comercial y financiera que atiende la demanda para que tu equipo humano solo se enfoque en cerrar ventas.',
    },
    {
      key: 'trafico-garantizado',
      label: 'Tráfico Garantizado',
      body: 'Impulsamos campañas de medios que llevan tráfico calificado a tu catálogo. Aseguramos un flujo constante de prospectos listos para convertir, maximizando el retorno de tu inversión publicitaria.',
    },
    {
      key: 'catalogo-inteligente',
      label: 'Catálogo Inteligente',
      body: 'El carrito más avanzado del mercado. El catálogo de tu marca personaliza la oferta según la búsqueda de cada cliente, lo ayuda a elegir, y así acelera la decisión de compra y tu ciclo de venta.',
    },
    {
      key: 'ahorro-materiales',
      label: 'Ahorro en Materiales',
      body: 'Accedé a acuerdos exclusivos con marcas líderes de todo el mundo. Optimizá tus costos operativos mediante compras a escala y maximizá tus márgenes de ganancia.',
    },
  ],
  primaryCta: { label: 'Sumá tu marca', href: partnersMailto() },
  secondaryCta: { label: 'Ver catálogo', href: '/catalogo' },
}

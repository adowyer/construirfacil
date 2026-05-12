/**
 * lib/content/marca-landing/hausind.ts
 *
 * Contenido editorial de la landing de Hausind. Reemplaza eventualmente
 * a hausind.com. Tono: industrial serio + cálido humano (B2B + B2C).
 */

import type { MarcaLandingContent } from './types'

export const hausindContent: MarcaLandingContent = {
  hero: {
    eyebrow: 'HAUSIND',
    headline: 'Industria que se siente hogar.',
    subheadline:
      'Casas industrializadas diseñadas para crecer con quienes las habitan.',
    backgroundImage: '/bosque.jpg',
    ctaPrimary: { label: 'Ver casas', href: '/catalogo' },
    ctaSecondary: { label: 'El sistema', href: '#sistema' },
  },

  manifesto: {
    eyebrow: 'La filosofía',
    title: 'La Casa que Crece.',
    body:
      'Cada familia tiene su ritmo. Cada hogar, su etapa. Diseñamos casas modulares que se expanden con el tiempo: empezás con lo necesario, sumás cuando podés. Una arquitectura honesta donde el espacio se adapta a la vida — y no al revés.',
    image: '/la-casa-que-crece.png',
  },

  system: {
    eyebrow: 'El sistema',
    title: 'Flex Build Suit.',
    intro:
      'La única solución constructiva 100% industrializada del mercado. Precisión de fábrica, calidez de hogar.',
    image: '/Flex-Build-Suit.png',
    attributes: [
      { label: 'Versátil', body: 'Adaptable a cada terreno y programa de uso.' },
      { label: 'Modulable', body: 'Plantas que se rearman sin reescribir el proyecto.' },
      { label: 'Escalable', body: 'Crece con la familia y con el desarrollo.' },
      { label: 'Industrializado', body: 'Precisión milimétrica, control de fábrica.' },
      { label: 'Eficiente', body: 'Tiempos predecibles, costos claros.' },
      { label: 'Honesto', body: 'Materiales reales, terminaciones nobles.' },
      { label: 'Rápido', body: 'De plano a llave en meses, no en años.' },
      { label: 'Inteligente', body: 'Sistemas pensados para que la casa trabaje por vos.' },
    ],
  },

  solutions: {
    eyebrow: 'Soluciones',
    title: 'Tres formatos. Una misma industria.',
    intro:
      'Desde un módulo compacto hasta un desarrollo completo: la misma precisión industrial detrás de cada decisión.',
    items: [
      {
        key: 'smart-box',
        title: 'Smart Box',
        tagline: 'Lo esencial, en pocos m².',
        body:
          'Módulos compactos para usos secundarios: estudio, oficina, hospedaje, refugio. Listos en semanas, instalados en días.',
        image: '/atlas-slide.png',
      },
      {
        key: 'smart-house',
        title: 'Smart House',
        tagline: 'Tu casa terminada.',
        body:
          'El catálogo completo de viviendas industrializadas. Crece con tu familia, se adapta a tu terreno, conserva su valor.',
        image: '/bosque-slide.png',
        cta: { label: 'Ver el catálogo', href: '/catalogo' },
      },
      {
        key: 'smart-build',
        title: 'Smart Build',
        tagline: 'Proyectos a escala.',
        body:
          'Para desarrollos, organismos públicos y obras de gran envergadura. Volumen, plazos y precisión industrial — sin sorpresas.',
        image: '/terra-slide.png',
        cta: {
          label: 'Hablar con el equipo',
          href: 'mailto:cotizar@hausind.com?subject=Proyecto%20a%20escala%20%E2%80%94%20Smart%20Build',
        },
      },
    ],
  },

  lineas: {
    eyebrow: 'Líneas',
    title: 'Tres mundos. Tres maneras de habitar.',
    intro:
      'Cada línea es una conversación distinta entre arquitectura, paisaje y quien la habita.',
    items: [
      {
        slug: 'atlas',
        label: 'Atlas',
        tagline: 'Geografía y arquitectura.',
        image: '/atlas-slide.png',
        href: '/catalogo?linea=ATLAS',
      },
      {
        slug: 'bosque',
        label: 'Bosque',
        tagline: 'Vivir entre árboles.',
        image: '/bosque-slide.png',
        href: '/catalogo?linea=BOSQUE',
      },
      {
        slug: 'terra',
        label: 'Terra',
        tagline: 'Modular, esencial, infinita.',
        image: '/terra-slide.png',
        href: '/catalogo?linea=TERRA',
      },
    ],
  },

  featured: {
    eyebrow: 'Catálogo',
    title: 'Casas en producción.',
    ctaAll: { label: 'Ver catálogo completo', href: '/catalogo' },
  },

  closeout: {
    title: '¿Querés tu casa?',
    body:
      'Empezamos por lo simple: contanos cómo querés vivir. Te mostramos los modelos que mejor encajan.',
    ctaB2C: { label: 'Ver modelos', href: '/catalogo' },
    ctaB2B: {
      label: 'Proyectos a escala',
      href: 'mailto:cotizar@hausind.com?subject=Proyecto%20a%20escala%20%E2%80%94%20Hausind',
    },
  },
}

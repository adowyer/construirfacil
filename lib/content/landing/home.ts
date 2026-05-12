/**
 * lib/content/landing/home.ts
 *
 * Contenido editorial de la home pública de ConstruirFácil. Reusa el
 * shape MarcaLandingContent (Hero / System / Solutions / Lineas / Featured
 * / Closeout) para aprovechar los componentes ya construidos.
 *
 * Tono: industrial serio + cálido humano. Basado en hausind.com pero
 * adaptado a ConstruirFácil como agregador. La sección "Proyectos a gran
 * escala" (Argentina/China) queda OMITIDA por decisión editorial.
 */

import type { MarcaLandingContent } from '@/lib/content/marca-landing/types'

export const homeLandingContent: MarcaLandingContent = {
  hero: {
    eyebrow: 'HAUSIND',
    headline: 'Construir',
    rotatingSuffix: [
      'rápido.',
      'eficiente.',
      'rentable.',
      'inteligente.',
    ],
    subheadline:
      'La única solución constructiva 100% industrializada del mercado — precisión de fábrica, calidez de hogar.',
    backgroundImage: '/bosque.jpg',
    ctaPrimary: { label: 'Ver el catálogo', href: '/catalogo' },
    ctaSecondary: { label: 'El sistema', href: '#sistema' },
  },

  system: {
    eyebrow: 'Explorador de Catálogo',
    title: '3 Estilos. 3 Sistemas.',
    intro:
      'Descubrí en nuestro catálogo la casa perfecta, con el estilo que mejor se ajusta a tus gustos y necesidades y construila en cualquiera de nuestros 3 sistemas constructivos.',
    image: '/Flex-Build-Suit.png',
    attributes: [
      {
        label: 'Línea Bosque',
        body: 'Vivir entre árboles. Una arquitectura que respeta el entorno y se mimetiza con la naturaleza, ofreciendo calidez y vistas ininterrumpidas.',
        image: '/bosque.jpg',
      },
      {
        label: 'Línea Atlas',
        body: 'Geografía y arquitectura. Espacios pensados para dominar el terreno, con volumetrías fuertes y materiales que envejecen con nobleza.',
        image: '/atlas.jpg',
      },
      {
        label: 'Línea Terra',
        body: 'Modular, esencial, infinita. Diseños contemporáneos, expansibles y de líneas puras que se adaptan a cualquier contexto.',
        image: '/terra.jpg',
      },
      {
        label: 'Steel Plus',
        body: 'Estructura autoportante de acero cortado con láser y paneles térmicos tipo sándwich (SIP). Su resistencia flexible combinada con un núcleo de alta densidad ofrece gran aislamiento acústico y térmico, rapidez de montaje y 100% de relocalización.',
        image: '/.png', // Fallback for now, maybe there are other images
      },
      {
        label: 'Wood Plus',
        body: 'Sólida estructura de entramado ligero en madera misionera tratada y secada, con garantía de resistencia sísmica. Sus múltiples capas de revestimiento y aislación aseguran confort superior y una vida útil de más de 100 años.',
        image: '/bosque-slider.png',
      },
      {
        label: 'Stone Plus',
        body: 'Hormigón armado pre-modulado en una sola pieza con capas de EPS de alta densidad integradas. Una evolución del sistema tradicional que garantiza extrema solidez, eficiencia térmica superior y un proceso limpio y veloz.',
        image: '/atlas.jpg',
      },
    ],
  },

  features: {
    eyebrow: 'Sistema de construcción inteligente',
    title: 'Flex Build Suit.',
    intro: 'Hausind® optimiza la construcción de la A a la Z, con diversificación industrializada de cada rubro clave. Logramos completa flexibilidad y eficiencia, reduciendo los tiempos de obra –sin desvíos ni fugas– dándole un mejor producto final a menor costo.',
    items: [
      {
        title: 'Versátil',
        body: 'La normalización e industrialización de los productos Hausind® permite resolver con eficiencia todo tipo de obras y diseños, desde un simple módulo hasta grandes superficies.',
      },
      {
        title: 'Modulable',
        body: 'Hausind® es más versátil que otras opciones industriales gracias a la precisión de las piezas y componentes que componen nuestras opciones constructivas Box y Flat.',
      },
      {
        title: 'Escalable',
        body: 'Cualquier obra realizada con proveedores y productos Hausind® puede ampliarse sin complicaciones en cualquier momento, añadiendo m2 rápidamente a la superficie original.',
      },
      {
        title: 'Precisa',
        body: 'En obras de escala Hausind® utiliza piezas precisamente construidas por robots de alta complejidad, que se ensamblan unas a otras para que nada falle, ahorrando tiempo y dinero.',
      },
      {
        title: 'Eficiente',
        body: 'Hausind® se adapta a la calidad y requerimientos del ambiente, con una amplia gama de materiales que se podrán combinar según su necesidad, gusto y presupuesto.',
      },
      {
        title: 'Portable',
        body: 'Cualquier obra basada en módulos y componentes Hausind® puede ser desmontada, estibada y re-localizada sin riesgos ni gastos elevados, acompañando sus objetivos.',
      },
      {
        title: 'Sustentable',
        body: 'Hausind® utiliza materiales de bajo impacto que son 100% reciclables o reutilizables, y suman calidad a un sistema que reduce significativamente el estrés laboral del personal.',
      },
      {
        title: 'Rentable',
        body: 'Con Hausind® logrará una sustancial reducción de costos en cada etapa de la obra, gracias a la capacidad constructiva inigualable, que maximiza sus beneficios.',
      },
    ],
  },

  video: {
    eyebrow: 'Sistemas Tecnificados',
    title: 'Casas que no se construyen, se fabrican.',
    intro:
      'Las casas Hausind® se fabrican en sistemas altamente tecnificados, con asistencia robótica y precisión, para que una vez montada la vivienda, todo funcione como imaginamos. Eso ahorra tiempo, evita desvíos de dinero y garantiza calidad por muchos más años.',
    youtubeId: 'Z0SY9gpxmFs',
    // Modo scroll-story tipo Apple Performance: el video corre siempre
    // de fondo. El user scrollea y van apareciendo título, accent y body.
    story: {
      title: 'Casas que no se construyen,',
      accent: 'se fabrican.',
      body:
        'Las casas Hausind® se fabrican en sistemas altamente tecnificados, con asistencia robótica y precisión. Una vez montada la vivienda, todo funciona como lo imaginamos. Eso ahorra tiempo, evita desvíos de dinero y garantiza calidad por muchos más años.',
    },
  },

  solutions: {
    eyebrow: 'Modelos Destacados',
    title: 'Una casa para cada estilo de vida.',
    intro:
      'Conocé nuestros modelo, diseñados para maximizar la eficiencia industrial sin comprometer la estética.',
    items: [
      {
        key: 'smart-box',
        title: 'Casa Guayubirá',
        tagline: 'Línea Bosque',
        body:
          'Una integración perfecta con el entorno natural, combinando calidez y precisión constructiva.',
        image: '/bosque-slide.png',
        cta: { label: 'Conocer más', href: '/catalogo' },
      },
      {
        key: 'smart-house',
        title: 'Casa Escandinavia',
        tagline: 'Línea Atlas',
        body:
          'El equilibrio exacto entre el estilo industrial contemporáneo y la flexibilidad modular.',
        image: '/atlas-slider.png',
        cta: { label: 'Conocer más', href: '/catalogo' },
      },
      {
        key: 'smart-build',
        title: 'Casa Domuyo',
        tagline: 'Línea Terra',
        body:
          'Diseño sólido y atemporal, preparado para los desafíos más exigentes en cualquier terreno.',
        image: '/terra-slide.png',
        cta: { label: 'Ver catálogo completo', href: '/catalogo' },
      },
    ],
  },

  // `lineas` y `featured` removidos — las líneas ya viven arriba del
  // catálogo y el slider de modelos destacados (solutions) reemplaza
  // al teaser de catálogo redundante.

  closeout: {
    title: '¿Hacemos realidad tu proyecto?',
    body:
      'Tenemos un gran equipo preparado para asistirte en cada paso de la construcción de tu nueva obra, y un excelente pool de proveedores para dotarla de los mejores materiales y terminaciones.',
    ctaB2C: { label: 'Ver modelos', href: '/catalogo' },
    ctaB2B: {
      label: 'Hablar con un asesor',
      href: 'mailto:hola@construirfacil.com?subject=Consulta%20ConstruirF%C3%A1cil',
    },
  },
}

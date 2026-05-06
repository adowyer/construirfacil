/**
 * lib/data/heroContent.ts
 *
 * Contenido editorial del HeroRow del catálogo. La versión `short` se renderea
 * en cada slide; la versión `long` se muestra en el modal "Ver más".
 *
 * Source: "Anexo A Sistema Constructivo.docx" (sección breve para slides,
 * sección original para el modal).
 */

export type HeroBullet = { name: string; body: string }

export type HeroSection = {
  id: string
  eyebrow: string
  title: string
  intro?: string
  short: HeroBullet[]
  long: HeroBullet[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 1 — Principal (centro). El ADN de Hausind.
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_PRINCIPAL: HeroSection = {
  id: 'principal',
  eyebrow: 'Hausind® Flex Build Suite',
  title: 'Verdaderas casas industrializadas',
  intro:
    'Tecnología y diseño inteligente para que tu casa esté lista en tiempo récord, sin sorpresas.',
  short: [
    {
      name: 'Trayectoria real',
      body: '+50.000 m² construidos y miles de familias avalan nuestra garantía de precio, tiempo y calidad.',
    },
    {
      name: 'Verdaderas casas',
      body: 'No hacemos módulos ni cajas. Creamos hogares con tecnología industrial y alma de hogar.',
    },
    {
      name: 'Alta performance',
      body: 'Modelo industrial inspirado en la industria automotriz: mayor escala, menores costos.',
    },
    {
      name: 'Diseño inteligente',
      body: 'Espacios previstos para evolucionar. Crecé y cambiá la distribución sin obras ni demoliciones.',
    },
    {
      name: 'Impacto positivo',
      body: 'Construcción amigable que prioriza recursos locales y procesos de baja huella ambiental.',
    },
  ],
  long: [
    {
      name: 'Experiencia real',
      body: 'Hemos acompañado a miles de familias en todo el país a tener su casa. Más de 50.000 m² avalan a nuestro equipo de arquitectos, constructores e ingenieros. Garantizamos precio, tiempo y calidad en un proceso sin sorpresas.',
    },
    {
      name: 'Verdaderas casas',
      body: 'Industrializamos los procesos, pero no fabricamos módulos ni boxes. Hacemos casas reales con condiciones técnicas superiores.',
    },
    {
      name: 'Modelo automotriz',
      body: 'Nuestras casas se fabrican bajo un modelo de alta performance inspirado en la industria automotriz. Esto permite una escala inigualable, velocidad de implantación y mejores costos.',
    },
    {
      name: 'Diseño inteligente',
      body: 'Lo mejor de nuestros diseños no se ve. Cada espacio está previsto para su uso. La flexibilidad es nuestro diferencial: podés crecer sin obras ni demoliciones.',
    },
    {
      name: 'Casas amigables',
      body: 'La integración con el entorno es nuestra premisa. Privilegiamos recursos locales, el uso de madera y hormigón de bajo impacto elaborado bajo estrictas normas ambientales.',
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Flex Build Suite — el sistema constructivo (entre Casa que Crece y Principal).
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_FLEX: HeroSection = {
  id: 'flex',
  eyebrow: 'Sistema constructivo',
  title: 'Flex Build Suite',
  intro:
    'Hausind® optimiza la construcción de la A a la Z, con diversificación industrializada de cada rubro clave. Logramos completa flexibilidad y eficiencia, reduciendo los tiempos de obra —sin desvíos ni fugas— dándole un mejor producto final a menor costo.',
  short: [
    { name: 'Versátil',  body: 'Resuelve con eficiencia todo tipo de obras y diseños, desde un módulo simple hasta grandes superficies.' },
    { name: 'Modulable', body: 'Más versátil que otras opciones industriales gracias a la precisión de piezas y componentes Box y Flat.' },
    { name: 'Escalable', body: 'Cualquier obra puede ampliarse sin complicaciones, sumando m² rápidamente sobre la superficie original.' },
    { name: 'Precisa',   body: 'Piezas construidas por robots de alta complejidad que se ensamblan para que nada falle.' },
    { name: 'Eficiente', body: 'Se adapta a la calidad y requerimientos del ambiente con una amplia gama de materiales combinables.' },
    { name: 'Portable',  body: 'Las obras basadas en módulos pueden desmontarse, estibarse y re-localizarse sin riesgos.' },
    { name: 'Sustentable', body: 'Materiales de bajo impacto, 100% reciclables o reutilizables. Sistema con menor estrés laboral.' },
    { name: 'Rentable',  body: 'Reducción sustancial de costos en cada etapa de la obra gracias a la capacidad constructiva.' },
  ],
  long: [
    { name: 'Versátil',    body: 'La normalización e industrialización de los productos Hausind® permite resolver con eficiencia todo tipo de obras y diseños, desde un simple módulo hasta grandes superficies.' },
    { name: 'Modulable',   body: 'Hausind® es más versátil que otras opciones industriales gracias a la precisión de las piezas y componentes que componen nuestras opciones constructivas Box y Flat.' },
    { name: 'Escalable',   body: 'Cualquier obra realizada con proveedores y productos Hausind® puede ampliarse sin complicaciones en cualquier momento, añadiendo m² rápidamente a la superficie original.' },
    { name: 'Precisa',     body: 'En obras de escala Hausind® utiliza piezas precisamente construidas por robots de alta complejidad, que se ensamblan unas a otras para que nada falle, ahorrando tiempo y dinero.' },
    { name: 'Eficiente',   body: 'Hausind® se adapta a la calidad y requerimientos del ambiente, con una amplia gama de materiales que se podrán combinar según su necesidad, gusto y presupuesto.' },
    { name: 'Portable',    body: 'Cualquier obra basada en módulos y componentes Hausind® puede ser desmontada, estibada y re-localizada sin riesgos ni gastos elevados, acompañando sus objetivos.' },
    { name: 'Sustentable', body: 'Hausind® utiliza materiales de bajo impacto que son 100% reciclables o reutilizables, y suman calidad a un sistema que reduce significativamente el estrés laboral del personal.' },
    { name: 'Rentable',    body: 'Con Hausind® logrará una sustancial reducción de costos en cada etapa de la obra, gracias a la capacidad constructiva inigualable, que ahorra ahorro y maximiza sus beneficios.' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 2 — Cómo elegir y mudarte
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_MUDARSE: HeroSection = {
  id: 'mudarse',
  eyebrow: 'Cómo elegir y mudarte',
  title: 'De la elección a la mudanza',
  intro: 'Un proceso integral, sin sorpresas, para que llegues a tu casa rápido.',
  short: [
    { name: 'Diseño Flex',         body: 'Elegí tu modelo y superficie en nuestro catálogo inteligente.' },
    { name: 'Lote + Casa',         body: 'Soluciones integrales en tu terreno o con lote incluido, 100% financiados.' },
    { name: 'Financiación',        body: 'Planes a medida según tu perfil crediticio.' },
    { name: 'Precio exacto',       body: 'El sistema cotiza con precisión la casa que elegís. Sin sorpresas.' },
    { name: 'Círculos Hausind',    body: 'Ahorrá tiempo y dinero sumándote a grupos de clientes.' },
    { name: 'Infraestructura',     body: 'Nos encargamos del terreno y la conexión a servicios.' },
    { name: 'Bases sólidas',       body: 'Plateas de hormigón que aseguran máximo confort y durabilidad.' },
    { name: 'Fabricación offsite', body: 'Producimos las "casapartes" en nuestras plantas industriales nacionales.' },
    { name: 'Implantación rápida', body: 'Ensamblaje y terminación en pocos días con precisión milimétrica.' },
    { name: 'Garantía total',      body: '10 años de garantía escrita sobre construcción y funcionamiento.' },
  ],
  long: [
    { name: 'Diseño Flex',         body: 'Elegí tu modelo y superficie ideal en nuestro catálogo inteligente.' },
    { name: 'Lote + Casa',         body: 'Construimos en tu lote o te brindamos una solución integral con terreno, 100% financiados.' },
    { name: 'Financiación',        body: 'Calificá y acordá el plan que mejor se ajuste a tus posibilidades.' },
    { name: 'Precio flexible',     body: 'Sin precios fijos arbitrarios. El sistema cotiza con exactitud la casa que elegís.' },
    { name: 'Círculos Hausind',    body: 'Ahorrá tiempo y dinero ingresando a un círculo junto a otros clientes.' },
    { name: 'Infraestructura',     body: 'Nos encargamos de la preparación del terreno y la conexión a servicios.' },
    { name: 'Bases sólidas',       body: 'Plateas de hormigón o losas suspendidas para asegurar máximo confort y durabilidad.' },
    { name: 'Fabricación offsite', body: 'Producimos las "casapartes" en nuestras plantas de Posadas, Bs. As., Córdoba y Neuquén.' },
    { name: 'Implantación rápida', body: 'Tu casa llega lista para ser ensamblada y terminada en pocos días con máxima precisión.' },
    { name: 'Garantía total',      body: 'Garantía escrita por 10 años sobre la construcción y su funcionamiento.' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 3 — Ventajas Imbatibles
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_VENTAJAS: HeroSection = {
  id: 'ventajas',
  eyebrow: 'Ventajas imbatibles',
  title: 'Por qué elegir Hausind®',
  intro: undefined,
  short: [
    { name: 'Ahorro energético', body: 'Gastá hasta un 50% menos en climatización.' },
    { name: 'Tiempo récord',     body: 'Tu casa lista en plazos imbatibles, sin aumentos por retrasos.' },
    { name: 'Durabilidad',       body: 'Materiales nobles que garantizan una vida útil superior.' },
    { name: 'Llave en mano',     body: 'Recibí tu casa equipada y lista para habitar desde el primer día.' },
  ],
  long: [
    { name: 'Eficiencia energética', body: 'La eficiente combinación de materiales nobles permite que nuestras casas gasten hasta un 50% menos en energía para refrigeración y calefacción.' },
    { name: 'Tu casa en menos tiempo', body: 'Tener tu casa en tiempo récord no tiene precio, y eso además afecta su precio, porque nada va a aumentar o fallar durante su producción e instalación.' },
    { name: 'Durabilidad garantizada', body: 'La calidad y nobleza de los materiales elegidos nos permite garantizar la casa por 10 años, y su vida útil es insuperable, con mínimo mantenimiento.' },
    { name: 'Llave en mano', body: 'Las casas Hausind® se entregan listas para habitar. Pisos, puertas, ventanas, instalaciones eléctricas, muebles de cocina y placares, calefón, iluminación básica, todo viene colocado y listo.' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección 4 — Calidad y beneficios
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_CALIDAD: HeroSection = {
  id: 'calidad',
  eyebrow: 'Calidad y beneficios',
  title: 'Lo que viene incluido',
  intro: undefined,
  short: [
    { name: 'Crecimiento sin obra',   body: 'Flex Build Suite te permite ampliar tu hogar sin obra sucia ni ruidos.' },
    { name: 'Primeras marcas',        body: 'Calidad certificada en cada rubro, asegurando confort y durabilidad.' },
    { name: 'Equipamiento premium',   body: 'Muebles a medida con maderas, revestimientos y herrajes de alta gama.' },
    { name: 'Aislación DVH',          body: 'Confort térmico extremo y ahorro energético real en cada ambiente.' },
    { name: 'Instalaciones listas',   body: 'Todo previsto para luminarias, aires y futuras ampliaciones.' },
    { name: 'Catálogo de accesorios', body: 'Parrillas, paneles solares y equipamiento a precios exclusivos para sumar cuando quieras.' },
  ],
  long: [
    { name: 'Concepto Flex Build Suite', body: 'Casas que crecen o se modifican sin obra sucia ni demoliciones. Entregamos manual de uso y planos para su evolución futura.' },
    { name: 'Primeras marcas',           body: 'Trabajamos junto a marcas que te aseguran calidad y diseño. Así evitarás pérdidas y filtraciones que producen daños, y molestos ruidos o fallas de uso.' },
    { name: 'Muebles superiores',        body: 'Vanitorys completos, placares laminados y cocinas exclusivas a medida con herrajes inoxidables, puertas y rieles de calidad superior.' },
    { name: 'Aislación premium',         body: 'Muros y cerramientos con DVH para ahorrar un 50% en climatización y proteger la vida útil de la casa.' },
    { name: 'Instalaciones previstas',   body: 'Luminarias, aires frío/calor y futuras extensiones de baños o lavaderos; todo listo en cada bocatoma.' },
    { name: 'Catálogo de accesorios',    body: 'Todo lo que no está incluido, es posible. Parrillas, paneles solares, pérgolas y electrodomésticos a precios imbatibles para nuestros clientes.' },
  ],
}

// Orden visual del HeroRow (de izquierda a derecha):
//   crece ← flex ← PRINCIPAL → mudarse → ventajas → calidad
// Carga inicial: scroll al PRINCIPAL.
export const HERO_SECTIONS = [
  // crece se mantiene como slide aparte (data viene de brand_content.concept en DB).
  SECTION_FLEX,
  SECTION_PRINCIPAL,
  SECTION_MUDARSE,
  SECTION_VENTAJAS,
  SECTION_CALIDAD,
]

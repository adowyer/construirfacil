/**
 * lib/content/marca-landing/types.ts
 *
 * Shape del contenido editorial de una marca para la landing rica de
 * /marcas/[slug]. Todas las secciones son opcionales: una marca solo
 * llena las que tiene contenido para mostrar; las que faltan se omiten.
 */

export type CTA = {
  label: string
  href: string
}

export type MarcaHeroContent = {
  eyebrow?: string
  headline: string
  /** Suffix que rota animadamente al final del headline. Si está presente,
   *  el Hero renderea: <headline> <rotating-word>. Las palabras ciclan
   *  con cross-fade en color amarillo CF. */
  rotatingSuffix?: string[]
  subheadline?: string
  backgroundImage: string
  ctaPrimary: CTA
  ctaSecondary?: CTA
}

export type MarcaManifestoContent = {
  eyebrow?: string
  title: string
  body: string
  image: string
}

export type MarcaSystemAttribute = {
  label: string
  body?: string
  /** Nombre de un icono de lucide-react (ej. 'Boxes', 'Zap'). El renderer
   *  hace lookup en ICON_BY_NAME — si no existe, no se renderiza icono. */
  icon?: string
  /** Imagen asociada a la característica (para el modo explorer Apple-style) */
  image?: string
}

export type MarcaSystemContent = {
  eyebrow: string
  title: string
  intro: string
  image?: string
  attributes: MarcaSystemAttribute[]
}

export type MarcaFeatureItem = {
  title: string
  body: string
  image?: string
}

export type MarcaFeaturesContent = {
  eyebrow: string
  title: string
  intro?: string
  items: MarcaFeatureItem[]
}

export type MarcaSolutionItem = {
  key: string
  title: string
  tagline: string
  body: string
  image?: string
  cta?: CTA
}

export type MarcaSolutionsContent = {
  eyebrow: string
  title?: string
  intro?: string
  items: MarcaSolutionItem[]
}

export type MarcaLineaItem = {
  slug: string
  label: string
  tagline: string
  image: string
  href: string
}

export type MarcaLineasContent = {
  eyebrow: string
  title: string
  intro?: string
  items: MarcaLineaItem[]
}

export type MarcaFeaturedContent = {
  eyebrow: string
  title: string
  intro?: string
  ctaAll: CTA
}

export type MarcaCloseoutContent = {
  title: string
  body?: string
  ctaB2C: CTA
  ctaB2B: CTA
}

export type MarcaVideoContent = {
  eyebrow?: string
  title?: string
  intro?: string
  /** YouTube video ID — el renderer embebe vía nocookie con autoplay
   *  diferido al primer click del usuario. */
  youtubeId: string
  /** Si está presente, activa el modo "scroll story" tipo Apple Performance:
   *  el video corre de fondo siempre, y mientras el user scrollea, el
   *  título aparece grande+transparente y se achica al centro, después
   *  el accent en naranja entra desde abajo, y finalmente el body. */
  story?: {
    title: string
    accent: string
    body: string
  }
}

export type MarcaLandingContent = {
  hero?: MarcaHeroContent
  manifesto?: MarcaManifestoContent
  system?: MarcaSystemContent
  features?: MarcaFeaturesContent
  video?: MarcaVideoContent
  solutions?: MarcaSolutionsContent
  lineas?: MarcaLineasContent
  featured?: MarcaFeaturedContent
  closeout?: MarcaCloseoutContent
}

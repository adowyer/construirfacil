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
}

export type MarcaSystemContent = {
  eyebrow: string
  title: string
  intro: string
  image?: string
  attributes: MarcaSystemAttribute[]
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
  ctaAll: CTA
}

export type MarcaCloseoutContent = {
  title: string
  body?: string
  ctaB2C: CTA
  ctaB2B: CTA
}

export type MarcaLandingContent = {
  hero?: MarcaHeroContent
  manifesto?: MarcaManifestoContent
  system?: MarcaSystemContent
  solutions?: MarcaSolutionsContent
  lineas?: MarcaLineasContent
  featured?: MarcaFeaturedContent
  closeout?: MarcaCloseoutContent
}

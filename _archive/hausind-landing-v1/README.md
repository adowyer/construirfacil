# Hausind landing — snapshot v1

Capturado el 2026-05-13. Esta era la home editorial estilo Apple que vivía en
`app/page.tsx` cuando `/` servía como landing de Hausind dentro del repo de
ConstruirFácil.

Al pasar `/` a ser la home genérica de ConstruirFácil (agregador multi-marca),
moví los archivos acá para tenerlos a mano cuando levantemos `hausind.com`
como app separada.

## Archivos

- `app/page.tsx` — server component que renderiza `MarcaLanding` con el
  contenido específico de la home.
- `components/LandingHeader.tsx` — header transparente que cambia a blurred al
  scrollear; logo grande en hero, chico cuando se hace sticky.
- `lib/content/landing/home.ts` — copy completo (hero, system/features,
  video story, solutions, lineas, featured, closeout).

## Dependencias vivas en `main`

Estos archivos importan componentes que **siguen en `main`** porque también
los usa `/marcas/[slug]` (la landing rica de cada marca):

- `components/marca-landing/*` (Hero, VideoStory, Solutions, Features,
  Reveal, TypewriterText, Video, etc.) — sistema genérico de landing
- `lib/content/marca-landing/types` — tipos compartidos
- `lib/supabase/queries/featured`
- `public/Wooden-Modular-House-Timelapse.mp4`
- `public/Hausind-Logo.png`

## Cómo restaurar

```bash
git mv _archive/hausind-landing-v1/app/page.tsx app/page.tsx
git mv _archive/hausind-landing-v1/components/LandingHeader.tsx components/LandingHeader.tsx
mkdir -p lib/content/landing
git mv _archive/hausind-landing-v1/lib/content/landing/home.ts lib/content/landing/home.ts
```

O simplemente `git log --oneline` y `git checkout <hash> -- <file>` desde
antes del archivado.

# Landing CF v1 (archivada 2026-05-14)

Versión "single-screen" de las landings B2C/B2B con 5 items en columna izquierda
(flecha roja + label) y panel grande a la derecha que cambiaba al hover.

Incluía:
- Typewriter del título "La manera más inteligente y fácil de Construir"
- Cursor rosa CF titilando
- Stagger en cascada blanco→gris de los 5 items
- Flechas con swoosh sincronizado al delay del item
- Hover scale en labels
- Footer 30vh con logo CF

Descartada porque "sin scroll" se sentía como una pantalla de "sitio en
construcción". Reemplazada por una landing scroll-driven con hero slideshow,
sección editorial estilo Apple "Three chips" y footer institucional.

Si querés restaurarla:
1. Copiar `LandingCF.tsx` y `landing-cf.css` de vuelta a `components/landing/`
   y `app/`.
2. La copy en `lib/content/landing-cf.ts` se mantuvo (los textos siguen
   sirviendo en la nueva versión).

-- =============================================================================
-- ConstruirFácil — Anchos de banner del HomeRow
-- Migration: 0045_home_slide_banner_width.sql
-- =============================================================================
-- Hasta ahora los banners del HomeRow (slide_key='banner') tenían un flag
-- booleano `narrow` que controlaba sólo dos anchos (default vs angosto).
-- Necesitamos 4 anchos diferenciados, alineados con los que ya existen en
-- el HeroRow:
--
--   wide   → 672px / 16:10  (como Principal o Todo en Uno)
--   medium → 336px / 4:5    (como Mudate antes / Entrega Programada)
--   narrow → 290px           (como Lote + Casa)
--   text   → 336px sin fondo, texto left-aligned (como "Encontrá la línea…")
--
-- Aplica sólo a slide_key='banner'; los slots canónicos home-1..home-5
-- tienen layouts fijos por slot y ignoran banner_width.
--
-- Backfill de las 4 copias creadas en 0043:
--   - Sin image_url y admin_label like '%copia%' → 'text'      (intro)
--   - Con image_url y admin_label like '%copia%' → 'medium'    (cards)
--   - Resto → 'wide' (el default)
-- =============================================================================

alter table public.home_slide_content
  add column if not exists banner_width text;

-- CHECK constraint (drop si ya existía por re-runs)
alter table public.home_slide_content
  drop constraint if exists home_slide_content_banner_width_check;

alter table public.home_slide_content
  add constraint home_slide_content_banner_width_check
  check (
    banner_width is null
    or banner_width in ('wide', 'medium', 'narrow', 'text')
  );

-- Backfill: las copias de la 0043 (admin_label contiene "(copia)").
update public.home_slide_content
   set banner_width = 'text'
 where slide_key = 'banner'
   and admin_label like '%(copia)%'
   and image_url is null
   and banner_width is null;

update public.home_slide_content
   set banner_width = 'medium'
 where slide_key = 'banner'
   and admin_label like '%(copia)%'
   and image_url is not null
   and banner_width is null;

-- Resto de banners (si los hubiera) y futuras inserciones quedan en 'wide'.
update public.home_slide_content
   set banner_width = 'wide'
 where slide_key = 'banner'
   and banner_width is null;

alter table public.home_slide_content
  alter column banner_width set default 'wide';

comment on column public.home_slide_content.banner_width is
  'Ancho del slide cuando slide_key=banner (wide/medium/narrow/text). Ignorado en los slots canónicos home-1..home-5.';

-- =============================================================================
-- ConstruirFácil — Copiar las 4 "Financiación" del HeroRow al HomeRow
-- Migration: 0043_home_duplicate_finance_banners.sql
-- =============================================================================
-- Fuentes en `header_slide_content` (CF / variant b2c o NULL):
--   1) slide_kind = 'lineas-intro'           → "Encontrá la línea de crédito…"
--   2) slide_kind = 'linea-card' (3 filas)   → Mixta / Bancarios / Directa
-- Total = 4. Destino: `home_slide_content` como `slide_key='banner'`
-- (es el único kind repetible permitido por el CHECK de home, ver 0032).
-- Se insertan INMEDIATAMENTE DESPUÉS de home-5 ("Elegí tu casa") preservando
-- el orden relativo original (intro primero, luego las 3 cards por sort_order).
--
-- Mapping header → home:
--   slide_kind             → slide_key = 'banner'
--   title                  → label
--   eyebrow                → eyebrow
--   body                   → body
--   cta_label, cta_url     → cta_label, cta_url
--   bg                     → bg
--   image_url              → image_url
--   narrow                 → narrow
--   admin_label            → admin_label + ' (copia)' (interno, no se renderiza)
--   status                 → status
--   subtitle/long_body/gallery_urls/panel_image_url/is_cf_pinned: NO se copian
--   cta_style/text_color/body_color: NULL → effectiveHomeBanner usa fallbacks
--
-- Idempotente: si ya hay copias (admin_label LIKE '%(copia)'), no hace nada.
-- =============================================================================

do $$
declare
  v_existing int;
  v_src      int;
  v_s5_order int;
begin
  -- Guard idempotente
  select count(*) into v_existing
    from public.home_slide_content
   where marca_id is null
     and variant = 'b2c'
     and slide_key = 'banner'
     and admin_label like '%(copia)%';
  if v_existing > 0 then
    raise notice 'Ya existen % copias — skip.', v_existing;
    return;
  end if;

  -- Validar las 4 fuentes en header_slide_content (1 intro + 3 cards)
  select count(*) into v_src
    from public.header_slide_content
   where marca_id is null
     and (variant is null or variant = 'b2c')
     and slide_kind in ('lineas-intro', 'linea-card');
  if v_src <> 4 then
    raise exception
      'Se esperaban 4 fuentes (1 lineas-intro + 3 linea-card) en header_slide_content, se encontraron %.',
      v_src;
  end if;

  -- sort_order de home-5 ("Elegí tu casa")
  select sort_order into v_s5_order
    from public.home_slide_content
   where marca_id is null and variant = 'b2c' and slide_key = 'home-5'
   limit 1;
  if v_s5_order is null then v_s5_order := 50; end if;

  -- Hacer lugar: shift +4 a todo lo que viene después de home-5
  update public.home_slide_content
     set sort_order = sort_order + 4
   where marca_id is null
     and variant = 'b2c'
     and sort_order > v_s5_order;

  -- Insertar las copias. Orden: 'lineas-intro' primero (0), después
  -- las 'linea-card' por su sort_order original.
  insert into public.home_slide_content
    (marca_id, variant, slide_key, admin_label,
     eyebrow, label, body, cta_label, cta_url, cta_style,
     bg, image_url, text_color, body_color, narrow,
     sort_order, status)
  select
    null, 'b2c', 'banner',
    case
      when admin_label is null or admin_label = '' then '(copia)'
      else admin_label || ' (copia)'
    end as admin_label,
    eyebrow,
    title as label,
    body, cta_label, cta_url,
    null as cta_style,
    bg, image_url,
    null as text_color, null as body_color,
    narrow,
    v_s5_order
      + row_number() over (
          order by
            case when slide_kind = 'lineas-intro' then 0 else 1 end,
            sort_order
        ) as sort_order,
    status
  from public.header_slide_content
  where marca_id is null
    and (variant is null or variant = 'b2c')
    and slide_kind in ('lineas-intro', 'linea-card');

  raise notice 'OK: 4 copias insertadas en home (sort_order % .. %).',
    v_s5_order + 1, v_s5_order + 4;
end $$;

-- =============================================================================
-- Verificación:
-- select sort_order, slide_key, admin_label, eyebrow, label
--   from public.home_slide_content
--  where marca_id is null and variant='b2c'
--  order by sort_order;
-- =============================================================================

-- =============================================================================
-- ConstruirFácil — Slides 'banner' repetibles (header + HomeRow)
-- Migration: 0032_banner_slides.sql
-- =============================================================================
-- Nuevo slide_kind/slide_key 'banner': slide genérico repetible que CF (y las
-- marcas en su header) pueden AGREGAR (promos, contenido extra). 4 presets:
-- Grande/Chico (narrow) × Foto (image_url) / Color (bg). Diseño fijo.
--
-- ADITIVA Y SEGURA: agrega columnas nullable, relaja CHECKs y vuelve los
-- índices únicos PARCIALES (excluyendo los kinds repetibles). NO toca filas
-- existentes (singletons/linea-card siguen igual). Idempotente. Si el editor
-- SQL de Supabase hace rollback, correr por bloques.
-- =============================================================================

-- ── header_slide_content ────────────────────────────────────────────────────
alter table public.header_slide_content add column if not exists bg     text;
alter table public.header_slide_content add column if not exists narrow boolean;

-- slide_kind: sumar 'banner'. (constraint inline de 0027 → nombre default.)
alter table public.header_slide_content
  drop constraint if exists header_slide_content_slide_kind_check;
alter table public.header_slide_content
  add constraint header_slide_content_slide_kind_check
  check (slide_kind in
    ('pasos','principal','crece','flex','lineas-intro','linea-card','banner'));

-- Único parcial: singletons únicos por (marca_id,variant,slide_kind); los
-- repetibles (linea-card, banner) quedan afuera (se identifican por id).
drop index if exists public.header_slide_singleton_uniq;
create unique index if not exists header_slide_singleton_uniq
  on public.header_slide_content (marca_id, variant, slide_kind)
  nulls not distinct
  where slide_kind not in ('linea-card','banner');

-- ── home_slide_content ──────────────────────────────────────────────────────
-- (bg, image_url, narrow ya existen en 0031.)
alter table public.home_slide_content
  drop constraint if exists home_slide_content_slide_key_check;
alter table public.home_slide_content
  add constraint home_slide_content_slide_key_check
  check (slide_key in
    ('home-1','home-2','home-3','home-4','home-5','banner'));

drop index if exists public.home_slide_uniq;
create unique index if not exists home_slide_uniq
  on public.home_slide_content (marca_id, variant, slide_key)
  nulls not distinct
  where slide_key <> 'banner';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- select conname from pg_constraint
--  where conrelid='public.header_slide_content'::regclass and contype='c';
-- select indexdef from pg_indexes where indexname in
--   ('header_slide_singleton_uniq','home_slide_uniq');
-- =============================================================================

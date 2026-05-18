-- =============================================================================
-- ConstruirFácil — Contenido editable del header (slider HeroRow)
-- Migration: 0027_header_slide_content.sql
-- =============================================================================
-- 3 versiones de header (ver docs/header-footer-registro.md):
--   marca_id NULL, variant 'b2c' → versión B2C  (ruta /)            — admin CF
--   marca_id NULL, variant 'b2b' → versión B2B  (ruta /empresas)    — admin CF
--   marca_id = X                 → versión de esa marca (/catalogo/{slug})
--                                  — la administra la marca (portal)
--   is_cf_pinned = true          → slides `pasos`/`principal`: presentes en
--                                  TODAS las versiones, SOLO CF los edita,
--                                  read-only para la marca.
--
-- Resolución (en lib/supabase/queries/header_content.ts):
--   B2C/B2B  : is_cf_pinned ∪ (marca_id NULL AND variant=<v>)
--   Marca X  : is_cf_pinned ∪ (marca_id = X)
--   Sin filas → HeroRow usa su hardcoded actual (cero regresión).
--
-- slide_kind fijo en código (los TIPOS no se editan). Singletons: uno por
-- (marca_id,variant,slide_kind). `linea-card` es REPETIBLE (N por scope) →
-- queda fuera del unique parcial, se maneja por id. Editable = texto + foto
-- (sin tamaño). Modal "Ver más": aparece si `long_body` tiene contenido;
-- muestra slider de `gallery_urls` + el long_body.
--
-- Estilo sin `begin/commit` ni `do $$`: cada statement idempotente por sí
-- solo (patrón 0020/0026). NULLS NOT DISTINCT + índice único parcial = PG15+.
-- Reads públicos; writes solo service-role. Sin seed (fallback al hardcoded).
-- =============================================================================

create table if not exists public.header_slide_content (
  id            uuid primary key default gen_random_uuid(),
  marca_id      uuid references public.marcas(id) on delete cascade,
  variant       text check (variant is null or variant in ('b2c','b2b')),
  is_cf_pinned  boolean not null default false,
  slide_kind    text not null
                  check (slide_kind in
                    ('pasos','principal','crece','flex','lineas-intro','linea-card')),
  eyebrow       text,
  title         text,
  subtitle      text,
  body          text,
  cta_label     text,
  cta_url       text,
  image_url     text,
  long_body     text,
  gallery_urls  text[] not null default '{}',
  sort_order    integer not null default 0,
  status        text not null default 'active'
                  check (status in ('active','inactive','archived')),
  updated_at    timestamptz not null default now()
);

comment on column public.header_slide_content.marca_id is
  'NULL = versión CF (B2C/B2B según variant). Con valor = versión de esa marca.';
comment on column public.header_slide_content.variant is
  'Solo en filas CF: b2c (/) o b2b (/empresas). NULL en filas de marca y en pinned.';
comment on column public.header_slide_content.is_cf_pinned is
  'pasos/principal: inyectados en TODAS las versiones, solo CF edita, read-only marca.';
comment on column public.header_slide_content.long_body is
  'Texto largo del modal. Si tiene contenido → aparece "Ver más" y abre el modal.';
comment on column public.header_slide_content.gallery_urls is
  'Fotos del slider del modal (las sube la marca/CF al bucket header-images).';

-- Singletons únicos por (marca_id,variant,slide_kind). NULLS NOT DISTINCT →
-- (NULL,'b2c','crece') y (X,NULL,'crece') y (NULL,NULL,'pasos') únicos cada
-- uno. `linea-card` queda afuera (repetible, se identifica por id).
create unique index if not exists header_slide_singleton_uniq
  on public.header_slide_content (marca_id, variant, slide_kind)
  nulls not distinct
  where slide_kind <> 'linea-card';

create index if not exists idx_header_slide_marca   on public.header_slide_content (marca_id);
create index if not exists idx_header_slide_variant on public.header_slide_content (variant);
create index if not exists idx_header_slide_pinned  on public.header_slide_content (is_cf_pinned) where is_cf_pinned;
create index if not exists idx_header_slide_status  on public.header_slide_content (status);
create index if not exists idx_header_slide_order   on public.header_slide_content (sort_order);

drop trigger if exists header_slide_content_updated_at on public.header_slide_content;
create trigger header_slide_content_updated_at
  before update on public.header_slide_content
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- Bucket público header-images (foto principal + galería del modal)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'header-images',
  'header-images',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "header-images: public read" on storage.objects;
create policy "header-images: public read"
  on storage.objects for select
  using (bucket_id = 'header-images');

-- (sin policies de INSERT/UPDATE/DELETE — solo service-role escribe)

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte, después)
-- =============================================================================
-- select count(*) from public.header_slide_content;  -- 0 (sin seed, ok)
-- select indexname from pg_indexes where tablename = 'header_slide_content';
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'header-images';
-- =============================================================================

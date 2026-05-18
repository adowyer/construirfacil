-- =============================================================================
-- ConstruirFácil — Contenido editable del HomeRow (slider inferior)
-- Migration: 0031_home_slide_content.sql
-- =============================================================================
-- Mismo modelo que header_slide_content (0027) pero para el slider inferior,
-- y ADEMÁS visual editable (bg, foto, colores, narrow, CTA). 5 slots
-- canónicos (home-1..home-5); B2C/B2B comparten slot, difieren en contenido.
--
--   marca_id NULL, variant 'b2c'/'b2b' → versión CF (B2C / B2B).
--   marca_id = X                       → versión de esa marca.
-- Resolución (en código): B2B hereda B2C; marca → propia; sin fila/campo
-- vacío → default de lib/content/home-defaults.ts. Snapshot al guardar.
--
-- Reads públicos / writes service-role. INCLUYE RLS+policy+grant para no
-- repetir el bug de 0030 (tabla sin policy = la app no lee). Idempotente,
-- estilo 0027 (sin transacción/do-block). Si el editor SQL hace rollback,
-- correr por bloques.
-- =============================================================================

create table if not exists public.home_slide_content (
  id          uuid primary key default gen_random_uuid(),
  marca_id    uuid references public.marcas(id) on delete cascade,
  variant     text check (variant is null or variant in ('b2c','b2b')),
  slide_key   text not null
                check (slide_key in
                  ('home-1','home-2','home-3','home-4','home-5')),
  eyebrow     text,
  label       text,
  body        text,
  cta_label   text,
  cta_url     text,
  cta_style   text check (cta_style is null or cta_style in ('primary','ghost','none')),
  bg          text,
  image_url   text,
  text_color  text,
  body_color  text,
  narrow      boolean,
  sort_order  integer not null default 0,
  status      text not null default 'active'
                check (status in ('active','inactive','archived')),
  updated_at  timestamptz not null default now()
);

comment on table public.home_slide_content is
  'Slider inferior (HomeRow). 5 slots home-1..home-5. B2B hereda B2C; campos vacíos → default de home-defaults.ts.';

create unique index if not exists home_slide_uniq
  on public.home_slide_content (marca_id, variant, slide_key)
  nulls not distinct;

create index if not exists idx_home_slide_marca   on public.home_slide_content (marca_id);
create index if not exists idx_home_slide_variant on public.home_slide_content (variant);
create index if not exists idx_home_slide_status  on public.home_slide_content (status);

drop trigger if exists home_slide_content_updated_at on public.home_slide_content;
create trigger home_slide_content_updated_at
  before update on public.home_slide_content
  for each row execute procedure public.handle_updated_at();

-- Lectura pública (contenido del sitio); escritura solo service-role
-- (bypassea RLS). Imprescindible: sin policy la app no lee (lección 0030).
grant select on table public.home_slide_content to anon, authenticated;
alter table public.home_slide_content enable row level security;
drop policy if exists "home_slide_content public read" on public.home_slide_content;
create policy "home_slide_content public read"
  on public.home_slide_content for select using (true);

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- select to_regclass('public.home_slide_content') tabla,
--        (select count(*) from pg_policies where tablename='home_slide_content') policies;
-- (esperado: tabla=home_slide_content, policies=1)
-- =============================================================================

-- =============================================================================
-- ConstruirFácil — campaigns
-- Migration: 0037_campaigns.sql
-- =============================================================================
-- Campañas de medios hiper-segmentadas. Cada fila = una localidad con copy
-- local. La ruta /casa-financiada/[localidad] busca la campaña por `slug` y
-- (si está activa y en ventana) inyecta un BANNER sintético al tope del
-- HomeRow → message-match con el creativo del medio. Sin fila / inactiva /
-- typo → home normal (la ruta NO hace 404: tráfico pago siempre aterriza).
--
-- El `slug` es la ÚNICA llave canónica: path = utm_content = campaign_slug en
-- el libro mayor (0038). El MEDIO va en utm_source, no acá (menos filas, se
-- comparan medios entre sí). Patrón 0036: RLS+grant+policy+trigger incluidos
-- (lección 0030/0031: tabla nueva sin policy → la app lee 0 filas).
--
-- Idempotente. Correr en BLOQUES en el editor SQL de Supabase (tabla /
-- índice / rls+grant+policy / trigger / seed) — un script multi-statement
-- revierte todo si un statement falla.
-- =============================================================================

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,                 -- localidad slugificada (san-patricio-del-chanar)
  localidad   text not null,                 -- display ("San Patricio del Chañar")
  provincia   text,
  eyebrow     text,                          -- ej. "Financiación 100%"
  headline    text not null,                 -- título del banner (copy local)
  subheadline text,                          -- bajada
  cta_label   text,                          -- null → "Ver catálogo"
  image_url   text,                          -- opcional: foto de fondo p/ matchear el creativo
  price_from  text,                          -- opcional, texto libre ("USD 45.000")
  active      boolean not null default true, -- on/off manual
  start_at    timestamptz,                   -- null = sin inicio
  end_at      timestamptz,                   -- null = sin fin
  updated_at  timestamptz not null default now()
);

comment on table public.campaigns is
  'Campañas de medios por localidad. slug = llave canónica (path/utm_content). Banner inyectado al tope del HomeRow en /casa-financiada/[slug].';

-- slug único (una campaña por localidad).
create unique index if not exists campaigns_slug_uniq
  on public.campaigns (slug);

-- updated_at (función compartida ya creada en 0005).
drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute procedure public.handle_updated_at();

-- Lectura pública (writes = service-role, bypassa RLS).
grant select on table public.campaigns to anon, authenticated;
alter table public.campaigns enable row level security;
drop policy if exists "campaigns public read" on public.campaigns;
create policy "campaigns public read"
  on public.campaigns for select using (true);

-- Seed: una campaña de ejemplo para probar la ruta de inmediato. Idempotente.
insert into public.campaigns
  (slug, localidad, provincia, eyebrow, headline, subheadline, cta_label, active)
select
  'san-patricio-del-chanar',
  'San Patricio del Chañar',
  'Neuquén',
  'Financiación 100%',
  'Accedé hoy a tu casa 100% financiada en San Patricio del Chañar',
  'Elegí tu modelo, postulate y pre-aprobamos tu forma de pago. Llave en mano, con un mínimo anticipo.',
  'Ver casas',
  true
where not exists (
  select 1 from public.campaigns where slug = 'san-patricio-del-chanar'
);

-- =============================================================================
-- select slug, localidad, active, start_at, end_at from public.campaigns;
-- =============================================================================

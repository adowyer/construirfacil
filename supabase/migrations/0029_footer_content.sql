-- =============================================================================
-- ConstruirFácil — Contenido editable del footer (cierre + institucional)
-- Migration: 0029_footer_content.sql
-- =============================================================================
-- Singleton CF-global (el footer es igual en todo el sitio: B2C/B2B/marca).
-- Una sola fila, key='cf'. Sin filas / campos vacíos → CatalogFooter cae a
-- su texto hardcoded (cero regresión). Las cards del marquee siguen en
-- footer_card_content (per-marca). Los logos partner quedan estáticos.
--
-- Editable: cierre (eyebrow, título, labels de CTA) + institucional
-- (copyright, labels/URLs de privacidad y términos). Las URLs de los CTA
-- del cierre se siguen construyendo por código (mailto) — no se editan acá.
--
-- Mismo estilo idempotente que 0027 (sin transacción/do-block). Reads
-- públicos; writes solo service-role. Sin seed.
-- =============================================================================

create table if not exists public.footer_content (
  id                   uuid primary key default gen_random_uuid(),
  key                  text not null unique,
  eyebrow              text,
  title                text,
  cta_primary_label    text,
  cta_secondary_label  text,
  copyright_text       text,
  privacy_label        text,
  privacy_url          text,
  terms_label          text,
  terms_url            text,
  updated_at           timestamptz not null default now()
);

comment on table public.footer_content is
  'Singleton (key=cf) del cierre + institucional del footer. Campos vacíos → CatalogFooter usa el hardcoded.';

drop trigger if exists footer_content_updated_at on public.footer_content;
create trigger footer_content_updated_at
  before update on public.footer_content
  for each row execute procedure public.handle_updated_at();

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- select to_regclass('public.footer_content');
-- select * from public.footer_content where key = 'cf';
-- =============================================================================

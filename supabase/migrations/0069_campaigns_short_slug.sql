-- =============================================================================
-- ConstruirFácil — campaigns.short_slug (alias corto imprimible)
-- Migration: 0069_campaigns_short_slug.sql
-- =============================================================================
-- Agregamos un slug "vanity" opcional para imprimir en material gráfico:
--   construirfacil.com/<short_slug>  →  mismo render que /casa-financiada/<slug>
-- El slug canónico (path = utm_content) NO cambia: la atribución sigue por
-- el path largo + UTMs. Esta URL corta es estrictamente para piezas
-- impresas / vía pública (sin UTMs).
--
-- Diseño:
--   - `short_slug` nullable: no toda campaña necesita versión impresa.
--   - Índice único parcial (where not null): dos campañas no pueden
--     compartir el alias, pero el null no estorba.
--   - SEO: la ruta corta usa canonical = '/casa-financiada/<slug>' + noindex
--     para no duplicar contenido frente al canónico.
--
-- Idempotente. Aplicar a mano en el SQL editor de Supabase.
-- =============================================================================

alter table public.campaigns
  add column if not exists short_slug text;

comment on column public.campaigns.short_slug is
  'Alias corto opcional para material impreso (ej. "rincon-de-los-sauces" → construirfacil.com/rincon-de-los-sauces). NO es el slug canónico; el canónico sigue siendo `slug` y vive en /casa-financiada/<slug>.';

create unique index if not exists campaigns_short_slug_uniq
  on public.campaigns (short_slug)
  where short_slug is not null;

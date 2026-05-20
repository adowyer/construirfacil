-- =============================================================================
-- ConstruirFácil — footer_card_content: cards institucionales (CF, sin marca)
-- Migration: 0042_footer_card_institutional.sql
-- =============================================================================
-- Habilita cards de footer "institucionales" (marca_id NULL) editables desde
-- /admin/footer. El catálogo público las usa para reemplazar las TRUST_CARDS
-- hardcodeadas en el agregador (/, /empresas), y como fallback en vistas
-- per-marca que no tengan cards propias.
--
-- Cambio: `marca_id` deja de ser NOT NULL. RLS / lectura pública / índice
-- existentes (creados en 0016) no se tocan: lectura pública ya cubre todas
-- las filas; el filtro is null lo hace la query.
--
-- Idempotente (DROP NOT NULL es no-op si ya está nullable).
-- =============================================================================

alter table public.footer_card_content
  alter column marca_id drop not null;

comment on column public.footer_card_content.marca_id is
  'NULL = card institucional (CF). El catálogo las usa cuando no hay cards de la marca primaria, y siempre en el agregador.';

-- =============================================================================
-- ConstruirFácil — Capa semántica definitiva de model_content (consumida por Ximia)
-- Migration: 0020_model_content_semantic_metadata.sql
-- =============================================================================
-- Extiende model_content con las columnas semánticas que Ximia (IA) usa para
-- EXPLICAR y RECOMENDAR modelos con propiedad (no solo specs).
--
-- 100% ADITIVO: el catálogo online NO lee estas columnas todavía → no se rompe
-- nada. Idempotente (add column if not exists).
--
-- Diseño acordado 2026-05-15:
--   vibe              — UNA frase: la sensación que transmite (no adjetivos sueltos)
--   perfect_for       — perfiles/escenarios concretos para los que es ideal
--   not_for           — a quién NO recomendar (clave anti-mismatch en el recommend)
--   emotional_anchors — 2-4 ganchos cortos que el LLM despliega en la explicación
--   vs_alternatives   — {"OTRO_MODELO":"por qué este y no el otro"} (desempate)
-- =============================================================================

begin;

alter table public.model_content
  add column if not exists vibe              text,
  add column if not exists perfect_for       text[],
  add column if not exists not_for           text[],
  add column if not exists emotional_anchors text[],
  add column if not exists vs_alternatives   jsonb;

comment on column public.model_content.vibe is
  'Una frase: la sensación que transmite el modelo (no adjetivos sueltos). Consumido por Ximia.';
comment on column public.model_content.perfect_for is
  'Perfiles/escenarios concretos para los que el modelo es ideal.';
comment on column public.model_content.not_for is
  'A quién NO recomendar el modelo — evita mismatch en la recomendación de Ximia.';
comment on column public.model_content.emotional_anchors is
  'Ganchos cortos (2-4) que el LLM despliega al explicar/recomendar.';
comment on column public.model_content.vs_alternatives is
  'jsonb {"OTRO_MODELO":"por qué este y no el otro"} — desempate para el recommend.';

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='model_content'
--    and column_name in ('vibe','perfect_for','not_for','emotional_anchors','vs_alternatives');
-- =============================================================================

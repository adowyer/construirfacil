-- =============================================================================
-- ConstruirFácil — brand_content / line_content per-marca
-- Migration: 0020_content_per_marca.sql
-- =============================================================================
-- Agrega `marca_id` (NULL = fila global / fallback) y reemplaza los UNIQUE
-- para que cada marca pueda tener su propia versión de un contenido.
--
-- ADITIVA Y SIN REGRESIÓN: las filas existentes quedan con marca_id NULL
-- (globales). El catálogo resuelve "fila de la marca > fila global".
--
-- Versión sin `do $$` ni transacción explícita: cada statement es
-- idempotente por sí solo (add column if not exists / drop constraint if
-- exists / create [unique] index if not exists). Se puede re-correr y se
-- puede pegar entero o por partes sin romper. NULLS NOT DISTINCT requiere
-- PostgreSQL 15+ (ya confirmado: la 0019 lo usó OK).
-- =============================================================================

-- ── brand_content ───────────────────────────────────────────────────────────
alter table public.brand_content
  add column if not exists marca_id uuid references public.marcas(id) on delete cascade;

comment on column public.brand_content.marca_id is
  'NULL = contenido global (fallback para todas las marcas). Con valor = override de esa marca.';

-- UNIQUE viejo sobre (key) — generado por el `unique` inline de 0005.
alter table public.brand_content drop constraint if exists brand_content_key_key;

-- UNIQUE nuevo (marca_id, key) como índice único (vale para onConflict de
-- PostgREST igual que un constraint). NULLS NOT DISTINCT → la fila global
-- (marca_id NULL) es única por key igual que antes.
create unique index if not exists brand_content_marca_key_uniq
  on public.brand_content (marca_id, key) nulls not distinct;

create index if not exists idx_brand_content_marca
  on public.brand_content (marca_id);

-- ── line_content ────────────────────────────────────────────────────────────
alter table public.line_content
  add column if not exists marca_id uuid references public.marcas(id) on delete cascade;

comment on column public.line_content.marca_id is
  'NULL = contenido global (fallback para todas las marcas). Con valor = override de esa marca.';

alter table public.line_content drop constraint if exists line_content_linea_tipologia_uniq;

create unique index if not exists line_content_marca_linea_tipologia_uniq
  on public.line_content (marca_id, linea, tipologia_code) nulls not distinct;

create index if not exists idx_line_content_marca
  on public.line_content (marca_id);

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte, después)
-- =============================================================================
-- select table_name, column_name
--   from information_schema.columns
--  where table_schema='public'
--    and table_name in ('brand_content','line_content')
--    and column_name='marca_id';
--
-- select indexrelid::regclass as idx
--   from pg_index
--  where indrelid in ('public.brand_content'::regclass,'public.line_content'::regclass)
--    and indisunique;
-- =============================================================================

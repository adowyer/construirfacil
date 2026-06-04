-- =============================================================================
-- ConstruirFácil — promo_messages: banners editables del catálogo
-- Migration: 0055_promo_messages.sql
-- =============================================================================
-- Tabla de banners promocionales editables desde admin que se insertan en
-- distintos slots del catálogo público:
--   • scope = 'hero'         → arriba del grid (1 por marca/provincia max)
--   • scope = 'intermediate' → entre filas del catálogo (N permitidos)
--
-- Se renderizan con el componente CatalogPromoBanner — mismas props que ya
-- existen: eyebrow + body + color (4 colores CF) + cta_label + cta_action.
-- El founder elige color por banner desde admin → admin/promos.
--
-- Resolución en runtime:
--   • Filtrar por marca_id (marca del catálogo activo)
--   • Si provincia_id IS NULL → banner aplica a todas las provincias
--   • Si provincia_id IS NOT NULL → solo aplica cuando el usuario eligió esa
--     provincia (filtro StickyFilters / persistencia localStorage)
--   • Ordenar por sort_order asc (slot determinístico entre filas)
--
-- IDEMPOTENTE. Cero impacto en catálogo si la tabla está vacía — el caller
-- maneja la lista vacía con un fallback (los hero banners de cohorte
-- tieneLote, hardcoded, siguen funcionando independientes).
-- =============================================================================

begin;

create table if not exists public.promo_messages (
  id           uuid primary key default gen_random_uuid(),
  marca_id     uuid not null references public.marcas(id)      on delete cascade,
  provincia_id uuid          references public.provincias(id)  on delete cascade,
  -- 'hero' (arriba del grid, máx 1 por contexto) | 'intermediate' (entre filas, N permitidos)
  scope        text not null default 'intermediate',
  titulo       text not null,
  cuerpo       text not null,
  color        text not null default 'green',
  cta_label    text,
  cta_action   text not null default 'none',
  activo       boolean not null default true,
  sort_order   int not null default 100,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Constraints inline (idempotentes con DO blocks porque CHECK no soporta if not exists)
do $$ begin
  if not exists (select 1 from pg_constraint where conname='promo_messages_scope_check' and conrelid='public.promo_messages'::regclass) then
    alter table public.promo_messages
      add constraint promo_messages_scope_check
      check (scope in ('hero','intermediate'));
  end if;
  if not exists (select 1 from pg_constraint where conname='promo_messages_color_check' and conrelid='public.promo_messages'::regclass) then
    alter table public.promo_messages
      add constraint promo_messages_color_check
      check (color in ('red','cyan','yellow','green'));
  end if;
  if not exists (select 1 from pg_constraint where conname='promo_messages_cta_action_check' and conrelid='public.promo_messages'::regclass) then
    alter table public.promo_messages
      add constraint promo_messages_cta_action_check
      check (cta_action in ('none','contactar','ximia','saber_mas'));
  end if;
end $$;

comment on table public.promo_messages is
  'Banners promocionales editables del catálogo público. Render con CatalogPromoBanner. Resolución: filtrar por marca, opcionalmente por provincia, ordenar por sort_order.';
comment on column public.promo_messages.provincia_id is
  'NULL = banner aplica a todas las provincias. NOT NULL = solo cuando el user eligió esa provincia.';
comment on column public.promo_messages.scope is
  '''hero'' = arriba del grid (recomendado 1 por contexto). ''intermediate'' = entre filas (N permitidos, ordenados por sort_order).';
comment on column public.promo_messages.cta_action is
  '''none'' = sin botón. ''contactar'' = abre ReservarModal genérico (form "Quiero que me contacten"). ''ximia'' = abre chat Ximia (cuando esté live). ''saber_mas'' = abre modal informativa.';

-- Índice para query del catálogo (la más caliente del runtime)
create index if not exists promo_messages_runtime_idx
  on public.promo_messages (marca_id, scope, activo, sort_order)
  where activo = true;

-- Trigger de updated_at — patrón estándar del repo
create or replace function public.set_promo_messages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_promo_messages_updated_at on public.promo_messages;
create trigger trg_promo_messages_updated_at
  before update on public.promo_messages
  for each row execute function public.set_promo_messages_updated_at();

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte)
-- =============================================================================
-- 1) Tabla presente:
--    select column_name, data_type from information_schema.columns
--     where table_schema='public' and table_name='promo_messages'
--     order by ordinal_position;
--
-- 2) Constraints (4 checks + 2 FKs + PK):
--    select conname from pg_constraint where conrelid='public.promo_messages'::regclass;
--
-- 3) Vacía hasta que el founder cargue desde admin:
--    select count(*) from public.promo_messages;
-- =============================================================================

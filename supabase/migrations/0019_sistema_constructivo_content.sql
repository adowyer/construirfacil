-- =============================================================================
-- ConstruirFácil — Librería de Sistemas Constructivos
-- Migration: 0019_sistema_constructivo_content.sql
-- =============================================================================
-- Modelo "librería": cada sistema constructivo es una entrada libre con
-- nombre propio. No hay taxonomía fija (steel/wood/stone).
--
--   marca_id NULL  → COMPARTIDO. Lo administra ConstruirFácil. Cualquier
--                     marca lo puede usar (ej. "Steel Frame", "Hormigón") sin
--                     recargarlo. Es el fallback.
--   marca_id = X    → PROPIETARIO de esa marca. Solo esa marca lo usa
--                     (ej. Hausind "Stone Plus", "Wood Plus").
--
-- El catálogo resuelve por `slug`: fila propietaria de la marca del modelo >
-- fila compartida > (sin fila → fallback legacy en el front).
--
-- Reads: público. Writes: solo service-role (admin actions). Idempotente.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- TABLE: sistema_constructivo_content
-- -----------------------------------------------------------------------------
create table if not exists public.sistema_constructivo_content (
  id              uuid primary key default gen_random_uuid(),
  marca_id        uuid references public.marcas(id) on delete cascade,
  slug            text not null,
  name            text not null,
  tagline         text,
  body            text,
  hero_image_url  text,
  sort_order      integer not null default 0,
  status          text not null default 'active'
                    check (status in ('active','inactive','archived')),
  updated_at      timestamptz not null default now()
);

comment on column public.sistema_constructivo_content.marca_id is
  'NULL = sistema COMPARTIDO (cualquier marca lo usa, lo administra CF). Con valor = PROPIETARIO de esa marca.';
comment on column public.sistema_constructivo_content.slug is
  'Identificador estable derivado del nombre. El catálogo matchea house_catalog.sistema_constructivo (free-text por SKU) contra este slug.';

-- UNIQUE (marca_id, slug) con NULLS NOT DISTINCT (PG15+): un compartido y el
-- override propietario de una marca pueden compartir slug (la marca pisa al
-- compartido en su catálogo). Nombre fijo para idempotencia.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sistema_constructivo_content_marca_slug_uniq'
      and conrelid = 'public.sistema_constructivo_content'::regclass
  ) then
    alter table public.sistema_constructivo_content
      add constraint sistema_constructivo_content_marca_slug_uniq
      unique nulls not distinct (marca_id, slug);
  end if;
end$$;

create index if not exists idx_sc_content_marca  on public.sistema_constructivo_content (marca_id);
create index if not exists idx_sc_content_slug   on public.sistema_constructivo_content (slug);
create index if not exists idx_sc_content_status on public.sistema_constructivo_content (status);

drop trigger if exists sistema_constructivo_content_updated_at on public.sistema_constructivo_content;
create trigger sistema_constructivo_content_updated_at
  before update on public.sistema_constructivo_content
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- Bucket público sc-images (fotos de fondo de las columnas SC)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sc-images',
  'sc-images',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sc-images: public read" on storage.objects;
create policy "sc-images: public read"
  on storage.objects for select
  using (bucket_id = 'sc-images');

-- (sin policies de INSERT/UPDATE/DELETE — solo service-role escribe)

-- -----------------------------------------------------------------------------
-- Seed inicial desde brand_content → 3 filas COMPARTIDAS (marca_id NULL).
--
-- Se siembran como compartidas (no propietarias) a propósito: hoy Hausind es
-- la única marca con catálogo y así el panel SC se ve idéntico al desplegar
-- (mismo copy que el legacy de brand_content, sin regresión visual). Cuando
-- haya una 2da marca, estas 3 se pueden re-scopear a "propietario Hausind"
-- desde el admin. tagline ← subtitle, body ← body: el panel aplica el mismo
-- splitFirstLine de compat cuando el tagline está vacío.
--
-- Solo inserta si la fila (NULL, slug) no existe → idempotente.
-- -----------------------------------------------------------------------------
insert into public.sistema_constructivo_content
  (marca_id, slug, name, tagline, body, sort_order, status)
select
  null,
  m.slug,
  m.sc_name,
  bc.subtitle,
  bc.body,
  m.ord,
  'active'
from (values
  ('system_steel',   'steel-plus', 'Steel Plus', 1),
  ('system_wood',    'wood-plus',  'Wood Plus',  2),
  ('system_concrete','stone-plus', 'Stone Plus', 3)
) as m(bc_key, slug, sc_name, ord)
join public.brand_content bc on bc.key = m.bc_key
on conflict (marca_id, slug) do nothing;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select slug, marca_id, name, left(coalesce(tagline,''),40) tagline
--   from public.sistema_constructivo_content order by marca_id nulls first, sort_order;
--
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'sc-images';
-- =============================================================================

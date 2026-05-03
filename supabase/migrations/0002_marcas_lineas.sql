-- =============================================================================
-- ConstruirFácil — Marcas (constructoras) + Líneas + house_catalog FKs
-- Migration: 0002_marcas_lineas.sql
-- =============================================================================
-- AUTOSUFICIENTE: crea todas las dependencias que faltan en la DB real.
-- Idempotente: se puede correr múltiples veces sin romper nada.
--
-- Crea (si no existen):
--   • Funciones helper: handle_updated_at, is_admin, owns_constructora
--   • Tablas: profiles, constructoras, lineas
--   • Trigger en auth.users para auto-crear profile
--   • Backfill de profiles para users ya existentes
--   • FKs constructora_id / linea_id en house_catalog (nullables)
--   • Trigger de sync para mantener linea/brand TEXT alineadas con las FKs
--   • SEED: HAUSIND + BOSQUE/ATLAS/TERRA + backfill de modelos
--   • RLS: profiles, constructoras, lineas
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- HELPER: updated_at trigger function
-- -----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- TABLE: profiles
-- Extiende auth.users con role + full_name a nivel app.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'buyer'
                check (role in ('admin', 'constructora_owner', 'buyer')),
  full_name   text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'App-level user profile extendiendo auth.users. Una fila por user.';

-- Trigger: crear profile automáticamente al crearse el user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'buyer'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: crear profile para users que ya existen
insert into public.profiles (id, role, full_name)
select u.id,
       coalesce(u.raw_user_meta_data->>'role', 'buyer'),
       coalesce(u.raw_user_meta_data->>'full_name', '')
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- -----------------------------------------------------------------------------
-- HELPER: is_admin()
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- TABLE: constructoras (UI: "Marca")
-- -----------------------------------------------------------------------------
create table if not exists public.constructoras (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete restrict,
  name              text not null,
  slug              text not null unique,
  description       text,
  logo_url          text,
  website_url       text,
  phone             text,
  city              text,
  province          text,
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  rejection_reason  text,
  approved_at       timestamptz,
  approved_by       uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.constructoras is
  'Perfiles de marca constructora. Una marca tiene un owner; debe estar approved para publicar.';

create index if not exists idx_constructoras_owner    on public.constructoras (owner_id);
create index if not exists idx_constructoras_status   on public.constructoras (status);
create index if not exists idx_constructoras_slug     on public.constructoras (slug);
create index if not exists idx_constructoras_province on public.constructoras (province);

drop trigger if exists constructoras_updated_at on public.constructoras;
create trigger constructoras_updated_at
  before update on public.constructoras
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- HELPER: owns_constructora()
-- -----------------------------------------------------------------------------
create or replace function public.owns_constructora(c_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.constructoras
    where id = c_id and owner_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- TABLE: lineas
-- -----------------------------------------------------------------------------
create table if not exists public.lineas (
  id              uuid primary key default gen_random_uuid(),
  constructora_id uuid not null references public.constructoras(id) on delete cascade,
  name            text not null,
  slug            text not null,
  tagline         text,
  description     text,
  hero_image_url  text,
  sort_order      integer not null default 0,
  status          text not null default 'active'
                    check (status in ('active','inactive','archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (constructora_id, slug)
);

comment on table public.lineas is
  'Líneas de producto bajo una marca. Ej: BOSQUE/ATLAS/TERRA bajo HAUSIND.';

create index if not exists idx_lineas_constructora on public.lineas (constructora_id);
create index if not exists idx_lineas_status       on public.lineas (status);
create index if not exists idx_lineas_sort         on public.lineas (constructora_id, sort_order);

drop trigger if exists lineas_updated_at on public.lineas;
create trigger lineas_updated_at
  before update on public.lineas
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- house_catalog: agregar FKs nullables
-- -----------------------------------------------------------------------------
alter table public.house_catalog
  add column if not exists constructora_id uuid references public.constructoras(id) on delete set null,
  add column if not exists linea_id        uuid references public.lineas(id) on delete set null;

create index if not exists idx_hc_constructora_id on public.house_catalog (constructora_id);
create index if not exists idx_hc_linea_id        on public.house_catalog (linea_id);

-- -----------------------------------------------------------------------------
-- Trigger: sync columnas TEXT (linea, brand) con las FKs.
-- Mantiene compatibilidad con queries existentes del catálogo público.
-- -----------------------------------------------------------------------------
create or replace function public.sync_house_catalog_denorm()
returns trigger
language plpgsql
as $$
begin
  if new.linea_id is not null then
    select name into new.linea
      from public.lineas
     where id = new.linea_id;
  end if;
  if new.constructora_id is not null then
    select name into new.brand
      from public.constructoras
     where id = new.constructora_id;
  end if;
  return new;
end;
$$;

drop trigger if exists house_catalog_sync_denorm on public.house_catalog;
create trigger house_catalog_sync_denorm
  before insert or update of constructora_id, linea_id
  on public.house_catalog
  for each row execute procedure public.sync_house_catalog_denorm();

-- -----------------------------------------------------------------------------
-- SEED + BACKFILL
-- -----------------------------------------------------------------------------
do $$
declare
  v_owner_id    uuid;
  v_hausind_id  uuid;
  v_bosque_id   uuid;
  v_atlas_id    uuid;
  v_terra_id    uuid;
  v_orphans     integer;
begin
  -- 1. Resolver owner desde auth.users por email
  select id into v_owner_id
    from auth.users
   where email = 'xtraordinary.ai@gmail.com';

  if v_owner_id is null then
    raise exception
      'No existe el user xtraordinary.ai@gmail.com en auth.users. Crealo en Supabase Auth antes de correr esta migración.';
  end if;

  -- 1b. Asegurar que tenga profile + role admin
  insert into public.profiles (id, role, full_name)
  values (v_owner_id, 'admin', 'Admin ConstruirFácil')
  on conflict (id) do update set role = 'admin';

  -- 2. Crear / actualizar HAUSIND (idempotente por slug)
  insert into public.constructoras (
    owner_id, name, slug, status, approved_at, approved_by, description
  )
  values (
    v_owner_id, 'HAUSIND', 'hausind', 'approved', now(), v_owner_id,
    'Marca propia inicial — catálogo BOSQUE / ATLAS / TERRA'
  )
  on conflict (slug) do update
    set name        = excluded.name,
        status      = 'approved',
        approved_at = coalesce(public.constructoras.approved_at, now()),
        approved_by = coalesce(public.constructoras.approved_by, excluded.approved_by)
  returning id into v_hausind_id;

  -- 3. Líneas bajo HAUSIND. Solo nombre/slug/orden — el resto se carga
  --    desde el CRUD de Líneas en el admin (Fase 4).
  insert into public.lineas (constructora_id, name, slug, sort_order)
  values
    (v_hausind_id, 'BOSQUE', 'bosque', 1),
    (v_hausind_id, 'ATLAS',  'atlas',  2),
    (v_hausind_id, 'TERRA',  'terra',  3)
  on conflict (constructora_id, slug) do nothing;

  select id into v_bosque_id from public.lineas where constructora_id = v_hausind_id and slug = 'bosque';
  select id into v_atlas_id  from public.lineas where constructora_id = v_hausind_id and slug = 'atlas';
  select id into v_terra_id  from public.lineas where constructora_id = v_hausind_id and slug = 'terra';

  -- 4. Backfill: todos los modelos a HAUSIND
  update public.house_catalog
     set constructora_id = v_hausind_id
   where constructora_id is null;

  -- 5. Backfill: linea_id por match case-insensitive del campo TEXT
  update public.house_catalog set linea_id = v_bosque_id
   where linea_id is null and upper(trim(linea)) = 'BOSQUE';

  update public.house_catalog set linea_id = v_atlas_id
   where linea_id is null and upper(trim(linea)) = 'ATLAS';

  update public.house_catalog set linea_id = v_terra_id
   where linea_id is null and upper(trim(linea)) = 'TERRA';

  -- 6. Reportar huérfanos
  select count(*) into v_orphans
    from public.house_catalog
   where linea_id is null;

  if v_orphans > 0 then
    raise notice
      '⚠ Hay % modelos sin linea_id. Revisá `select distinct linea from house_catalog where linea_id is null` para detectar líneas no incluidas en el seed.',
      v_orphans;
  else
    raise notice '✔ Backfill completo: 0 modelos sin linea_id.';
  end if;
end $$;

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles: own row read"   on public.profiles;
drop policy if exists "profiles: own row update" on public.profiles;
drop policy if exists "profiles: admin insert"   on public.profiles;
drop policy if exists "profiles: admin delete"   on public.profiles;

create policy "profiles: own row read"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: own row update"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles: admin insert"
  on public.profiles for insert
  with check (public.is_admin());

create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- constructoras
-- ---------------------------------------------------------------------------
alter table public.constructoras enable row level security;

drop policy if exists "constructoras: public read approved" on public.constructoras;
drop policy if exists "constructoras: owner update"         on public.constructoras;
drop policy if exists "constructoras: authenticated insert" on public.constructoras;
drop policy if exists "constructoras: admin delete"         on public.constructoras;

create policy "constructoras: public read approved"
  on public.constructoras for select
  using (
    status = 'approved'
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy "constructoras: owner update"
  on public.constructoras for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy "constructoras: authenticated insert"
  on public.constructoras for insert
  with check (auth.uid() is not null and (owner_id = auth.uid() or public.is_admin()));

create policy "constructoras: admin delete"
  on public.constructoras for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- lineas
-- ---------------------------------------------------------------------------
alter table public.lineas enable row level security;

drop policy if exists "lineas: public read active" on public.lineas;
drop policy if exists "lineas: owner insert"       on public.lineas;
drop policy if exists "lineas: owner update"       on public.lineas;
drop policy if exists "lineas: admin delete"       on public.lineas;

create policy "lineas: public read active"
  on public.lineas for select
  using (
    status = 'active'
    or public.owns_constructora(constructora_id)
    or public.is_admin()
  );

create policy "lineas: owner insert"
  on public.lineas for insert
  with check (
    public.is_admin()
    or (
      public.owns_constructora(constructora_id)
      and exists (
        select 1 from public.constructoras
         where id = constructora_id and status = 'approved'
      )
    )
  );

create policy "lineas: owner update"
  on public.lineas for update
  using (public.owns_constructora(constructora_id) or public.is_admin())
  with check (public.owns_constructora(constructora_id) or public.is_admin());

create policy "lineas: admin delete"
  on public.lineas for delete
  using (public.is_admin());

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN — correr aparte:
-- =============================================================================
-- select c.name as marca, l.name as linea, l.sort_order, count(hc.id) as modelos
--   from public.constructoras c
--   join public.lineas l on l.constructora_id = c.id
--   left join public.house_catalog hc on hc.linea_id = l.id
--  group by c.name, l.name, l.sort_order
--  order by c.name, l.sort_order;
--
-- -- modelos huérfanos (debería ser 0):
-- select count(*) from public.house_catalog where linea_id is null;
--
-- -- líneas detectadas en TEXT que no quedaron mapeadas (si el conteo > 0):
-- select distinct linea from public.house_catalog where linea_id is null;
-- =============================================================================

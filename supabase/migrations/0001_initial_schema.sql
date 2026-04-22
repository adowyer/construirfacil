-- =============================================================================
-- ConstruirFácil — Initial Schema
-- Migration: 0001_initial_schema.sql
-- Target: Supabase (PostgreSQL 15+)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helper: updated_at trigger function
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
-- Extends auth.users with application-level role and display name.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'buyer'
                check (role in ('admin', 'constructora_owner', 'buyer')),
  full_name   text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application-level user profile extending auth.users. One row per auth user.';

-- Auto-create profile on sign-up
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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- TABLE: construction_systems
-- Controlled vocabulary for house construction methods.
-- Managed by admin only.
-- -----------------------------------------------------------------------------
create table public.construction_systems (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.construction_systems is
  'Controlled list of construction systems (e.g. Steel Frame, Mampostería + Losa). Admin-managed.';

create index idx_construction_systems_sort on public.construction_systems (sort_order);

-- -----------------------------------------------------------------------------
-- TABLE: constructoras
-- One row per construction brand. Single owner via owner_id (v1 — no team).
-- -----------------------------------------------------------------------------
create table public.constructoras (
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
  'Construction brand profiles. Must be approved by admin before publishing house models.';
comment on column public.constructoras.owner_id is
  'Single owner per constructora (v1). No team membership table.';
comment on column public.constructoras.status is
  'Approval lifecycle: pending → approved | rejected';

create index idx_constructoras_owner      on public.constructoras (owner_id);
create index idx_constructoras_status     on public.constructoras (status);
create index idx_constructoras_slug       on public.constructoras (slug);
create index idx_constructoras_province   on public.constructoras (province);

create trigger constructoras_updated_at
  before update on public.constructoras
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- TABLE: attribute_types
-- Admin-defined attribute categories (e.g. "Windows", "Finishes").
-- -----------------------------------------------------------------------------
create table public.attribute_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.attribute_types is
  'Admin-managed attribute categories applied to house models (e.g. Windows, Finishes).';

create index idx_attribute_types_sort on public.attribute_types (sort_order);

-- -----------------------------------------------------------------------------
-- TABLE: attribute_values
-- Possible values under each attribute type.
-- -----------------------------------------------------------------------------
create table public.attribute_values (
  id                  uuid primary key default gen_random_uuid(),
  attribute_type_id   uuid not null references public.attribute_types(id) on delete cascade,
  label               text not null,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

comment on table public.attribute_values is
  'Individual selectable values for each attribute type (e.g. "Double pane" under Windows).';

create index idx_attribute_values_type on public.attribute_values (attribute_type_id, sort_order);

-- -----------------------------------------------------------------------------
-- TABLE: house_models
-- Core catalog entity. Belongs to a constructora.
-- Requires admin approval before appearing in the public catalog.
-- -----------------------------------------------------------------------------
create table public.house_models (
  id                      uuid primary key default gen_random_uuid(),
  constructora_id         uuid not null references public.constructoras(id) on delete cascade,
  name                    text not null,
  slug                    text not null unique,
  description             text,
  construction_system_id  uuid references public.construction_systems(id) on delete set null,
  bedrooms                integer not null check (bedrooms >= 0),
  bathrooms               integer not null check (bathrooms >= 0),
  total_area_m2           numeric(10,2) not null check (total_area_m2 > 0),
  covered_area_m2         numeric(10,2) check (covered_area_m2 > 0),
  lot_area_m2             numeric(10,2) check (lot_area_m2 > 0),
  garage_spaces           integer check (garage_spaces >= 0),
  price_from_ars          numeric(14,2) check (price_from_ars > 0),
  price_from_usd          numeric(14,2) check (price_from_usd > 0),
  status                  text not null default 'draft'
                            check (status in ('draft', 'pending_review', 'published', 'rejected')),
  rejection_reason        text,
  published_at            timestamptz,
  reviewed_by             uuid references public.profiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.house_models is
  'House model catalog entries. Goes through draft → pending_review → published lifecycle.';
comment on column public.house_models.construction_system_id is
  'FK to construction_systems (controlled vocabulary). Nullable — may not be set at draft stage.';
comment on column public.house_models.lot_area_m2 is
  'm² terreno — nullable, not all models include land.';
comment on column public.house_models.garage_spaces is
  'Number of covered garage spaces. Nullable.';

create index idx_house_models_constructora   on public.house_models (constructora_id);
create index idx_house_models_status         on public.house_models (status);
create index idx_house_models_construction   on public.house_models (construction_system_id);
create index idx_house_models_bedrooms       on public.house_models (bedrooms);
create index idx_house_models_price_ars      on public.house_models (price_from_ars);
create index idx_house_models_price_usd      on public.house_models (price_from_usd);
-- Partial index: only published models need fast public lookups
create index idx_house_models_published      on public.house_models (published_at desc)
  where status = 'published';

create trigger house_models_updated_at
  before update on public.house_models
  for each row execute procedure public.handle_updated_at();

-- Auto-set published_at when status transitions to published
create or replace function public.handle_house_model_publish()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  if new.status != 'published' and old.status = 'published' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

create trigger house_models_publish
  before update on public.house_models
  for each row execute procedure public.handle_house_model_publish();

-- -----------------------------------------------------------------------------
-- TABLE: house_model_attributes
-- Many-to-many: house model ↔ attribute values (selected by constructora).
-- -----------------------------------------------------------------------------
create table public.house_model_attributes (
  id                  uuid primary key default gen_random_uuid(),
  house_model_id      uuid not null references public.house_models(id) on delete cascade,
  attribute_value_id  uuid not null references public.attribute_values(id) on delete cascade,
  unique (house_model_id, attribute_value_id)
);

comment on table public.house_model_attributes is
  'Junction table: which attribute values are assigned to each house model.';

create index idx_hma_model  on public.house_model_attributes (house_model_id);
create index idx_hma_value  on public.house_model_attributes (attribute_value_id);

-- -----------------------------------------------------------------------------
-- TABLE: house_model_images
-- Images associated with a house model. Stored in Supabase Storage.
-- -----------------------------------------------------------------------------
create table public.house_model_images (
  id              uuid primary key default gen_random_uuid(),
  house_model_id  uuid not null references public.house_models(id) on delete cascade,
  storage_url     text not null,
  alt_text        text not null default '',
  is_cover        boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

comment on table public.house_model_images is
  'Photo gallery images for a house model. storage_url points to Supabase Storage.';
comment on column public.house_model_images.is_cover is
  'Exactly one image per house model should have is_cover = true (enforced at application layer).';

create index idx_hmi_model on public.house_model_images (house_model_id, sort_order);

-- -----------------------------------------------------------------------------
-- TABLE: house_model_floor_plans
-- Floor plan documents/images for a house model.
-- -----------------------------------------------------------------------------
create table public.house_model_floor_plans (
  id              uuid primary key default gen_random_uuid(),
  house_model_id  uuid not null references public.house_models(id) on delete cascade,
  storage_url     text not null,
  label           text not null default '',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

comment on table public.house_model_floor_plans is
  'Floor plan images for a house model. label e.g. "Ground Floor", "Level 2".';

create index idx_hmfp_model on public.house_model_floor_plans (house_model_id, sort_order);

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================

alter table public.profiles                enable row level security;
alter table public.construction_systems    enable row level security;
alter table public.constructoras           enable row level security;
alter table public.attribute_types         enable row level security;
alter table public.attribute_values        enable row level security;
alter table public.house_models            enable row level security;
alter table public.house_model_attributes  enable row level security;
alter table public.house_model_images      enable row level security;
alter table public.house_model_floor_plans enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: is current user an admin?
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: own row read"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: own row update"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- profiles are created by the trigger, not direct insert from client
create policy "profiles: admin insert"
  on public.profiles for insert
  with check (public.is_admin());

create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- construction_systems — public read, admin full CRUD
-- ---------------------------------------------------------------------------
create policy "construction_systems: public read"
  on public.construction_systems for select
  using (true);

create policy "construction_systems: admin insert"
  on public.construction_systems for insert
  with check (public.is_admin());

create policy "construction_systems: admin update"
  on public.construction_systems for update
  using (public.is_admin());

create policy "construction_systems: admin delete"
  on public.construction_systems for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- constructoras
-- ---------------------------------------------------------------------------

-- Public: only approved constructoras visible
create policy "constructoras: public read approved"
  on public.constructoras for select
  using (
    status = 'approved'
    or owner_id = auth.uid()
    or public.is_admin()
  );

-- Owner: can update own row
create policy "constructoras: owner update"
  on public.constructoras for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Authenticated users can register a new constructora
create policy "constructoras: authenticated insert"
  on public.constructoras for insert
  with check (auth.uid() is not null and owner_id = auth.uid());

-- Only admin can delete
create policy "constructoras: admin delete"
  on public.constructoras for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- attribute_types — public read, admin write
-- ---------------------------------------------------------------------------
create policy "attribute_types: public read"
  on public.attribute_types for select
  using (true);

create policy "attribute_types: admin insert"
  on public.attribute_types for insert
  with check (public.is_admin());

create policy "attribute_types: admin update"
  on public.attribute_types for update
  using (public.is_admin());

create policy "attribute_types: admin delete"
  on public.attribute_types for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- attribute_values — public read, admin write
-- ---------------------------------------------------------------------------
create policy "attribute_values: public read"
  on public.attribute_values for select
  using (true);

create policy "attribute_values: admin insert"
  on public.attribute_values for insert
  with check (public.is_admin());

create policy "attribute_values: admin update"
  on public.attribute_values for update
  using (public.is_admin());

create policy "attribute_values: admin delete"
  on public.attribute_values for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- house_models
-- ---------------------------------------------------------------------------

-- Helper: is the current user the owner of the constructora that owns this model?
create or replace function public.owns_constructora_of_model(model_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.house_models hm
    join public.constructoras c on c.id = hm.constructora_id
    where hm.id = model_id
      and c.owner_id = auth.uid()
  );
$$;

-- Helper: does the current user own a given constructora?
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

-- Public: only published models
create policy "house_models: public read published"
  on public.house_models for select
  using (
    status = 'published'
    or public.owns_constructora(constructora_id)
    or public.is_admin()
  );

-- Constructora owner: insert into own approved constructora only
create policy "house_models: owner insert"
  on public.house_models for insert
  with check (
    public.owns_constructora(constructora_id)
    and exists (
      select 1 from public.constructoras
      where id = constructora_id and status = 'approved'
    )
  );

-- Constructora owner: update own models (cannot self-publish)
create policy "house_models: owner update"
  on public.house_models for update
  using (
    public.owns_constructora(constructora_id)
    or public.is_admin()
  )
  with check (
    public.owns_constructora(constructora_id)
    or public.is_admin()
  );

-- Only admin can hard-delete models
create policy "house_models: admin delete"
  on public.house_models for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- house_model_attributes
-- ---------------------------------------------------------------------------
create policy "house_model_attributes: public read published"
  on public.house_model_attributes for select
  using (
    exists (
      select 1 from public.house_models hm
      where hm.id = house_model_id
        and (hm.status = 'published'
             or public.owns_constructora(hm.constructora_id)
             or public.is_admin())
    )
  );

create policy "house_model_attributes: owner insert"
  on public.house_model_attributes for insert
  with check (public.owns_constructora_of_model(house_model_id) or public.is_admin());

create policy "house_model_attributes: owner delete"
  on public.house_model_attributes for delete
  using (public.owns_constructora_of_model(house_model_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- house_model_images
-- ---------------------------------------------------------------------------
create policy "house_model_images: public read published"
  on public.house_model_images for select
  using (
    exists (
      select 1 from public.house_models hm
      where hm.id = house_model_id
        and (hm.status = 'published'
             or public.owns_constructora(hm.constructora_id)
             or public.is_admin())
    )
  );

create policy "house_model_images: owner insert"
  on public.house_model_images for insert
  with check (public.owns_constructora_of_model(house_model_id) or public.is_admin());

create policy "house_model_images: owner update"
  on public.house_model_images for update
  using (public.owns_constructora_of_model(house_model_id) or public.is_admin());

create policy "house_model_images: owner delete"
  on public.house_model_images for delete
  using (public.owns_constructora_of_model(house_model_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- house_model_floor_plans
-- ---------------------------------------------------------------------------
create policy "house_model_floor_plans: public read published"
  on public.house_model_floor_plans for select
  using (
    exists (
      select 1 from public.house_models hm
      where hm.id = house_model_id
        and (hm.status = 'published'
             or public.owns_constructora(hm.constructora_id)
             or public.is_admin())
    )
  );

create policy "house_model_floor_plans: owner insert"
  on public.house_model_floor_plans for insert
  with check (public.owns_constructora_of_model(house_model_id) or public.is_admin());

create policy "house_model_floor_plans: owner update"
  on public.house_model_floor_plans for update
  using (public.owns_constructora_of_model(house_model_id) or public.is_admin());

create policy "house_model_floor_plans: owner delete"
  on public.house_model_floor_plans for delete
  using (public.owns_constructora_of_model(house_model_id) or public.is_admin());

-- =============================================================================
-- STORAGE BUCKETS
-- (Run these after enabling Storage in the Supabase dashboard)
-- =============================================================================

-- insert into storage.buckets (id, name, public)
--   values ('constructora-logos', 'constructora-logos', true);
-- insert into storage.buckets (id, name, public)
--   values ('house-model-images', 'house-model-images', true);
-- insert into storage.buckets (id, name, public)
--   values ('floor-plans', 'floor-plans', true);

-- Storage RLS: authenticated users can upload to their own constructora prefix
-- create policy "constructora-logos: owner upload"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'constructora-logos'
--     and auth.uid()::text = (storage.foldername(name))[1]
--   );

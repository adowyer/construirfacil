-- =============================================================================
-- ConstruirFácil — Dev Seed Data
-- seed.sql
--
-- Prerequisites:
--   1. Run the migration: 0001_initial_schema.sql
--   2. Create the admin user manually in Supabase Auth Dashboard, note the UUID,
--      and replace ADMIN_USER_UUID below before running this file.
--      OR run this after the handle_new_user trigger fires for a registered user
--      and then UPDATE profiles SET role = 'admin' WHERE id = '<uuid>'.
--
-- Usage (Supabase CLI):
--   supabase db reset        -- applies migrations then seed.sql automatically
--   supabase db seed         -- seed only
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: Admin user role
-- The handle_new_user() trigger creates a 'buyer' profile automatically.
-- After the admin user registers via Auth, elevate their role here.
-- Replace the email address to match the actual admin account.
-- -----------------------------------------------------------------------------
-- UPDATE public.profiles
-- SET role = 'admin', full_name = 'Platform Admin'
-- WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'admin@construirfacil.com' LIMIT 1
-- );


-- -----------------------------------------------------------------------------
-- SECTION 2: construction_systems
-- -----------------------------------------------------------------------------
insert into public.construction_systems (id, name, slug, sort_order) values
  (gen_random_uuid(), 'Wood Framing Plus',        'wood-framing-plus',       10),
  (gen_random_uuid(), 'Steel Frame',              'steel-frame',             20),
  (gen_random_uuid(), 'Mampostería + Losa',        'mamposteria-losa',        30),
  (gen_random_uuid(), 'Wood Frame Tradicional',    'wood-frame-tradicional',  40)
on conflict (slug) do nothing;


-- -----------------------------------------------------------------------------
-- SECTION 3: attribute_types and attribute_values
-- 3 types: Windows, Doors, Finishes
-- -----------------------------------------------------------------------------

-- Windows
with ins_type as (
  insert into public.attribute_types (id, name, slug, description, sort_order)
  values (gen_random_uuid(), 'Windows', 'windows', 'Window type and glazing options', 10)
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.attribute_values (attribute_type_id, label, sort_order)
select ins_type.id, v.label, v.sort_order
from ins_type
cross join (values
  ('Double pane',         10),
  ('Single pane',         20),
  ('Aluminum frame',      30),
  ('PVC frame',           40),
  ('Wood frame',          50),
  ('Low-E glass coating', 60)
) as v(label, sort_order)
on conflict do nothing;

-- Doors
with ins_type as (
  insert into public.attribute_types (id, name, slug, description, sort_order)
  values (gen_random_uuid(), 'Doors', 'doors', 'Interior and exterior door specifications', 20)
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.attribute_values (attribute_type_id, label, sort_order)
select ins_type.id, v.label, v.sort_order
from ins_type
cross join (values
  ('Solid wood — interior',   10),
  ('Hollow core — interior',  20),
  ('Steel — exterior',        30),
  ('Reinforced security',     40),
  ('Sliding glass',           50),
  ('French doors',            60)
) as v(label, sort_order)
on conflict do nothing;

-- Finishes
with ins_type as (
  insert into public.attribute_types (id, name, slug, description, sort_order)
  values (gen_random_uuid(), 'Finishes', 'finishes', 'Interior finish quality and material options', 30)
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.attribute_values (attribute_type_id, label, sort_order)
select ins_type.id, v.label, v.sort_order
from ins_type
cross join (values
  ('Ceramic tile floors',    10),
  ('Porcelain tile floors',  20),
  ('Engineered wood floors', 30),
  ('Painted drywall',        40),
  ('Exposed concrete',       50),
  ('Granite countertops',    60),
  ('Quartz countertops',     70)
) as v(label, sort_order)
on conflict do nothing;

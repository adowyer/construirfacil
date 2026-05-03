-- =============================================================================
-- ConstruirFácil — Rename `constructoras` → `marcas`
-- Migration: 0003_rename_constructoras_to_marcas.sql
-- =============================================================================
-- Renombra la tabla `constructoras` y todas sus referencias (FKs, helpers,
-- triggers, RLS policies, índices, role en profiles) para alinear el modelo
-- de datos con el dominio del negocio: una "marca" es la entidad correcta.
--
-- Es idempotente vía IF EXISTS / DROP-CREATE. El trigger sync se recrea al
-- final para apuntar a la tabla `marcas`.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Drop policies que dependen de `owns_constructora()` o de la tabla
--    (envueltas en un check de existencia para que sea idempotente:
--    si ya corriste la migración antes, la tabla `constructoras` ya no existe
--    y los DROP POLICY ON public.constructoras tirarían error.)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'constructoras') then
    drop policy if exists "constructoras: public read approved" on public.constructoras;
    drop policy if exists "constructoras: owner update"         on public.constructoras;
    drop policy if exists "constructoras: authenticated insert" on public.constructoras;
    drop policy if exists "constructoras: admin delete"         on public.constructoras;
  end if;
end $$;

-- También removemos las policies viejas de `lineas` (quedaron de 0002).
drop policy if exists "lineas: public read active" on public.lineas;
drop policy if exists "lineas: owner insert"       on public.lineas;
drop policy if exists "lineas: owner update"       on public.lineas;
drop policy if exists "lineas: admin delete"       on public.lineas;

-- -----------------------------------------------------------------------------
-- 2. Drop trigger sync_house_catalog_denorm (lo recreamos al final)
-- -----------------------------------------------------------------------------
drop trigger if exists house_catalog_sync_denorm on public.house_catalog;

-- -----------------------------------------------------------------------------
-- 3. Drop funciones helper que dependen de la tabla
-- -----------------------------------------------------------------------------
drop function if exists public.owns_constructora(uuid);
drop function if exists public.owns_constructora_of_model(uuid);

-- -----------------------------------------------------------------------------
-- 4. Renombrar tabla y columnas FK
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'constructoras') then
    alter table public.constructoras rename to marcas;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'house_catalog' and column_name = 'constructora_id') then
    alter table public.house_catalog rename column constructora_id to marca_id;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'lineas' and column_name = 'constructora_id') then
    alter table public.lineas rename column constructora_id to marca_id;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Renombrar índices y constraints
-- -----------------------------------------------------------------------------
do $$
begin
  -- Tabla principal
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='constructoras_pkey') then
    alter index public.constructoras_pkey rename to marcas_pkey;
  end if;
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='constructoras_slug_key') then
    alter index public.constructoras_slug_key rename to marcas_slug_key;
  end if;

  -- Índices secundarios (los que existían en 0002)
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_constructoras_owner') then
    alter index public.idx_constructoras_owner rename to idx_marcas_owner;
  end if;
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_constructoras_status') then
    alter index public.idx_constructoras_status rename to idx_marcas_status;
  end if;
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_constructoras_slug') then
    alter index public.idx_constructoras_slug rename to idx_marcas_slug;
  end if;
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_constructoras_province') then
    alter index public.idx_constructoras_province rename to idx_marcas_province;
  end if;

  -- Índices en house_catalog y lineas
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_hc_constructora_id') then
    alter index public.idx_hc_constructora_id rename to idx_hc_marca_id;
  end if;
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_lineas_constructora') then
    alter index public.idx_lineas_constructora rename to idx_lineas_marca;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Renombrar trigger updated_at de la tabla principal
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where c.relname = 'marcas' and t.tgname = 'constructoras_updated_at'
  ) then
    alter trigger constructoras_updated_at on public.marcas rename to marcas_updated_at;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Comments actualizados
-- -----------------------------------------------------------------------------
comment on table public.marcas is
  'Marcas / proveedores. Una marca tiene un owner; debe estar approved para publicar.';

-- -----------------------------------------------------------------------------
-- 8. Update profiles.role: 'constructora_owner' → 'marca_owner'
-- -----------------------------------------------------------------------------
update public.profiles
   set role = 'marca_owner'
 where role = 'constructora_owner';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'marca_owner', 'buyer'));

-- -----------------------------------------------------------------------------
-- 9. Recrear funciones helper con nombres nuevos
-- -----------------------------------------------------------------------------
create or replace function public.owns_marca(m_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.marcas
    where id = m_id and owner_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 10. Recrear el trigger sync para sincronizar `linea` y `brand` desde
--     las FKs (linea_id, marca_id) hacia las columnas TEXT denormalizadas
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
  if new.marca_id is not null then
    select name into new.brand
      from public.marcas
     where id = new.marca_id;
  end if;
  return new;
end;
$$;

create trigger house_catalog_sync_denorm
  before insert or update of marca_id, linea_id
  on public.house_catalog
  for each row execute procedure public.sync_house_catalog_denorm();

-- -----------------------------------------------------------------------------
-- 11. Recrear RLS policies con nombres nuevos.
--     Cada policy se DROP IF EXISTS antes de CREATE para que sea idempotente.
-- -----------------------------------------------------------------------------

-- marcas
drop policy if exists "marcas: public read approved" on public.marcas;
create policy "marcas: public read approved"
  on public.marcas for select
  using (
    status = 'approved'
    or owner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "marcas: owner update" on public.marcas;
create policy "marcas: owner update"
  on public.marcas for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "marcas: authenticated insert" on public.marcas;
create policy "marcas: authenticated insert"
  on public.marcas for insert
  with check (auth.uid() is not null and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists "marcas: admin delete" on public.marcas;
create policy "marcas: admin delete"
  on public.marcas for delete
  using (public.is_admin());

-- lineas (re-creadas con owns_marca)
drop policy if exists "lineas: public read active" on public.lineas;
create policy "lineas: public read active"
  on public.lineas for select
  using (
    status = 'active'
    or public.owns_marca(marca_id)
    or public.is_admin()
  );

drop policy if exists "lineas: owner insert" on public.lineas;
create policy "lineas: owner insert"
  on public.lineas for insert
  with check (
    public.is_admin()
    or (
      public.owns_marca(marca_id)
      and exists (
        select 1 from public.marcas
         where id = marca_id and status = 'approved'
      )
    )
  );

drop policy if exists "lineas: owner update" on public.lineas;
create policy "lineas: owner update"
  on public.lineas for update
  using (public.owns_marca(marca_id) or public.is_admin())
  with check (public.owns_marca(marca_id) or public.is_admin());

drop policy if exists "lineas: admin delete" on public.lineas;
create policy "lineas: admin delete"
  on public.lineas for delete
  using (public.is_admin());

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'house_catalog' and column_name like '%marca%';
-- → debería listar `marca_id`
--
-- select count(*) from public.marcas;
-- → debería listar HAUSIND
--
-- select role, count(*) from public.profiles group by role;
-- → no debería haber 'constructora_owner', sí 'admin' y posiblemente 'marca_owner'
-- =============================================================================

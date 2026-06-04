-- =============================================================================
-- ConstruirFácil — Geo Layer & CUPO Catálogo
-- Migration: 0051_geo_layer_cupo_catalogo.sql
-- =============================================================================
-- Prerequisito: 0050_baseline_ximia_tables.sql (crea construction_quotas y
-- banks_financing). Esta migración las ALTERa para el modelo catálogo.
-- =============================================================================
-- Lleva el modelo de cupo + financiación de "single-project (Posadas al Río)"
-- a catálogo multi-marca × provincia. Diseño completo:
--   /Users/adowyer/Documents/XIMIA/AI-AGENT/Geo_Layer_y_Cupo_Catalogo.md
--
-- REUTILIZA lo que ya existe (NO crea tablas zonales nuevas):
--   - provincias  (0047) — jurisdicciones AR + CABA
--   - marca_zonas (0047) — exclusión + price_modifier_pct + extra_charge zonal,
--                          con granularidad por línea / sistema constructivo.
--                          → cubre disponibilidad-por-provincia y costos zonales.
--
-- CAMBIOS:
--   1. construction_quotas → cohorte (marca × provincia) + margin_pool_usd
--   2. banks_financing     → geo-gating (provincia, residencia, ingreso, rci)
--   3. INSERT línea IPVU Neuquén (faltaba en banks_financing)
--   4. SEED cupos Hausind × {Neuquén, Misiones} = 25
--
-- construction_quotas y banks_financing las crea la 0050 (baseline catch-up).
-- Estos ALTER asumen ese estado. Idempotente + transaccional.
--
-- Revisar los puntos  >>> CONFIRMAR  antes de descomentar COMMIT.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. construction_quotas: de "por proyecto" a cohorte "marca × provincia"
-- -----------------------------------------------------------------------------
alter table public.construction_quotas
  add column if not exists marca_id        uuid references public.marcas(id) on delete cascade,
  add column if not exists provincia_id    uuid references public.provincias(id) on delete cascade,
  add column if not exists margin_pool_usd numeric not null default 0,
  add column if not exists close_month     date;   -- cierre del cupo (editable desde admin); NULL = sin fecha definida

comment on column public.construction_quotas.margin_pool_usd is
  'Capacidad prestable acumulada por el cohorte (marca × provincia). El margen de los compradores "lista" lo alimenta; financia el gap de los financiados del mismo cupo.';
comment on column public.construction_quotas.start_month is
  'Inicio de la ventana del cupo (editable desde admin).';
comment on column public.construction_quotas.close_month is
  'Cierre planificado del cupo (editable desde admin). El lock real lo dispara available_slots=0 → status.';

-- catálogo no tiene proyecto: project_id pasa a opcional
alter table public.construction_quotas
  alter column project_id drop not null;

-- un solo cupo por cohorte (marca, provincia) en modo catálogo
create unique index if not exists uq_construction_quotas_marca_provincia
  on public.construction_quotas (marca_id, provincia_id)
  where project_id is null;

-- -----------------------------------------------------------------------------
-- 2. banks_financing: columnas de elegibilidad geográfica / residencia / ingreso
-- -----------------------------------------------------------------------------
alter table public.banks_financing
  add column if not exists provincia_id             uuid references public.provincias(id),
  add column if not exists min_residency_years      integer,
  add column if not exists max_household_income_ars numeric,
  add column if not exists rci                       numeric;

comment on column public.banks_financing.provincia_id is
  'Ámbito provincial de la línea. NULL = nacional.';
comment on column public.banks_financing.min_residency_years is
  'Antigüedad mínima de residencia en la provincia (ej. IPVU Neuquén = 5).';
comment on column public.banks_financing.max_household_income_ars is
  'Tope de ingreso familiar para calificar (ej. IPVU < 6,5 MM ARS).';
comment on column public.banks_financing.rci is
  'Relación cuota/ingreso máxima.';

-- las dos líneas "Banco Neuquén" son de Vivienda Única en NQN → geo-gatearlas
update public.banks_financing
   set provincia_id = (select id from public.provincias where slug = 'neuquen')
 where bank_name = 'Banco Neuquén'
   and provincia_id is null;

-- RCI de las 6 líneas preexistentes (fuente: Financiación_Bancaria.xlsx).
-- Casos "25% / 30%" → se guarda el tope 0,30 (decisión founder 2026-05-31).
update public.banks_financing set rci = 0.25 where bank_name = 'Banco Hipotecario' and product_name = 'Hipotecario UVA'                and rci is null;
update public.banks_financing set rci = 0.25 where bank_name = 'Banco Hipotecario' and product_name = 'Personal Construcción'          and rci is null;
update public.banks_financing set rci = 0.30 where bank_name = 'Banco Nación'      and product_name = 'Hipotecario Primera Vivienda'   and rci is null;
update public.banks_financing set rci = 0.30 where bank_name = 'Banco Nación'      and product_name = 'Hipotecario Segunda Vivienda'   and rci is null;
update public.banks_financing set rci = 0.30 where bank_name = 'Banco Neuquén'     and product_name = 'Hipotecario Vivienda Única 1'   and rci is null;
update public.banks_financing set rci = 0.30 where bank_name = 'Banco Neuquén'     and product_name = 'Hipotecario Vivienda Única 2'   and rci is null;

-- -----------------------------------------------------------------------------
-- 3. INSERT línea IPVU Neuquén (faltante) — fuente: Financiación_Bancaria.xlsx
--    TNA 2% UVI · 240m · 100% financiación · máx 150M
--    Constraints duros: residencia >= 5 años en NQN + ingreso familiar < 6,5 MM
-- -----------------------------------------------------------------------------
insert into public.banks_financing
  (bank_name, product_name, loan_type, destination,
   max_financing_pct, max_term_months, interest_rate, interest_adjustment,
   currency, max_loan_amount_ars, is_active,
   provincia_id, min_residency_years, max_household_income_ars, rci)
select
  'IPVU Neuquén', 'IPVU Vivienda Única', 'hipotecario', 'vivienda_unica',
  1.0, 240, 2, 'UVI',
  'ARS', 150000000, true,                       -- >>> CONFIRMAR currency ('ARS' vs 'UVI')
  (select id from public.provincias where slug = 'neuquen'), 5, 6500000, 0.30
where not exists (
  select 1 from public.banks_financing where bank_name = 'IPVU Neuquén'
);

-- -----------------------------------------------------------------------------
-- 4. SEED cupos Hausind (lanzamiento próxima semana)
--    >>> CONFIRMAR start_month (placeholder 2026-06-01) y status ('open')
-- -----------------------------------------------------------------------------
insert into public.construction_quotas
  (id, project_id, marca_id, provincia_id, quota_code, start_month,
   total_slots, available_slots, margin_pool_usd, status)
select gen_random_uuid(), null,
       '41860d9b-b3a3-4baa-85a8-49db3d25238d',                       -- Hausind
       (select id from public.provincias where slug = 'neuquen'),
       'HAUSIND-NEUQUEN', date '2026-06-01',
       25, 25, 0, 'open'
where not exists (
  select 1 from public.construction_quotas
   where marca_id = '41860d9b-b3a3-4baa-85a8-49db3d25238d'
     and provincia_id = (select id from public.provincias where slug = 'neuquen')
     and project_id is null
);

insert into public.construction_quotas
  (id, project_id, marca_id, provincia_id, quota_code, start_month,
   total_slots, available_slots, margin_pool_usd, status)
select gen_random_uuid(), null,
       '41860d9b-b3a3-4baa-85a8-49db3d25238d',                       -- Hausind
       (select id from public.provincias where slug = 'misiones'),
       'HAUSIND-MISIONES', date '2026-06-01',
       25, 25, 0, 'open'
where not exists (
  select 1 from public.construction_quotas
   where marca_id = '41860d9b-b3a3-4baa-85a8-49db3d25238d'
     and provincia_id = (select id from public.provincias where slug = 'misiones')
     and project_id is null
);

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (revisar antes de COMMIT)
-- -----------------------------------------------------------------------------
select 'cupos Hausind' as check, quota_code, total_slots, available_slots,
       margin_pool_usd, status
  from public.construction_quotas
 where marca_id = '41860d9b-b3a3-4baa-85a8-49db3d25238d';

select 'líneas financiación' as check, bank_name, product_name, provincia_id,
       min_residency_years, max_household_income_ars, rci,
       interest_rate, interest_adjustment
  from public.banks_financing
 order by provincia_id nulls first, bank_name, product_name;

commit;
-- rollback;  -- usar en lugar de commit si algo no cuadra

-- =============================================================================
-- DOWN (revertir manualmente — NO se ejecuta por defecto)
-- =============================================================================
-- begin;
--   delete from public.construction_quotas
--     where marca_id = '41860d9b-b3a3-4baa-85a8-49db3d25238d' and project_id is null;
--   delete from public.banks_financing where bank_name = 'IPVU Neuquén';
--   update public.banks_financing set provincia_id = null where bank_name = 'Banco Neuquén';
--   drop index if exists public.uq_construction_quotas_marca_provincia;
--   alter table public.construction_quotas
--     drop column if exists marca_id,
--     drop column if exists provincia_id,
--     drop column if exists margin_pool_usd;
--   alter table public.banks_financing
--     drop column if exists provincia_id,
--     drop column if exists min_residency_years,
--     drop column if exists max_household_income_ars,
--     drop column if exists rci;
-- commit;

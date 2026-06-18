-- =============================================================================
-- 0075 — Cupo UOCRA · Rincón de los Sauces (Neuquén): proyecto + lotes + cupo.
--
-- ⚠️ DRAFT — Andrea: COMPLETÁ los 4 placeholders (__...__) antes de correr.
--    Resuelve el "no_loteo" de Neuquén: hoy casa_lote no encuentra proyecto con lotes
--    en Neuquén → este seed habilita el camino Casa + Terreno para los UOCRA sin lote.
--    (Los que SÍ tienen lote van por ADUS y no usan esto.)
--
-- Correr en begin/commit, mirar la VERIFICACIÓN antes de COMMIT.
-- =============================================================================
begin;

-- (1) Proyecto. region='Neuquén' es lo que matchea con la provincia que pasa el agente.
insert into public.projects (project_name, project_slug, city, region, country, project_type,
                             is_active, minimum_units_to_start, private_can_cover_lot, description)
values ('Rincón de los Sauces — UOCRA', 'rincon-de-los-sauces', 'Rincón de los Sauces', 'Neuquén',
        'Argentina', 'loteo_uocra', true,
        25,   
        true, 'Loteo en alianza con UOCRA para afiliados sin terreno propio.')
on conflict (project_slug) do nothing;

-- (2) Lotes de la tierra UOCRA. N lotes idénticos (ajustá si varían).
insert into public.lots_inventory (project_id, lot_code, sector, area_m2, price_usd, status)
select p.id, 'RDS-' || lpad(g::text, 3, '0'), 'UOCRA',
       600,          
       37000,      
       'Available'
from public.projects p
cross join generate_series(1, 0) g  
where p.project_slug = 'rincon-de-los-sauces'
on conflict (lot_code) do nothing;

-- (3) Cupo 25/25, pool arranca en 0 (se llena con cierres al contado). Hausind × Neuquén.
insert into public.construction_quotas
  (project_id, marca_id, provincia_id, quota_code, total_slots, available_slots, margin_pool_usd, status, start_month)
select p.id, m.id, prov.id, 'RINCON-SAUCES-C1', 25, 25, 0, 'open', date '2026-06-01'
from public.projects p
cross join public.marcas m
cross join public.provincias prov
where p.project_slug = 'rincon-de-los-sauces'
  and m.name ilike 'hausind'
  and prov.slug = 'neuquen'
on conflict (quota_code) do nothing;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT)
-- -----------------------------------------------------------------------------
select 'proyecto' chk, project_slug, region, minimum_units_to_start from public.projects where project_slug='rincon-de-los-sauces';
select 'lotes disponibles' chk, count(*) lotes, min(price_usd) precio_lote from public.lots_inventory l
  join public.projects p on p.id=l.project_id where p.project_slug='rincon-de-los-sauces' and l.status='Available';
select 'cupo' chk, quota_code, total_slots, available_slots, margin_pool_usd from public.construction_quotas where quota_code='RINCON-SAUCES-C1';
-- Smoke test del camino casa+lote (debe encontrar el proyecto; gap NO financeable con pool 0 = honesto):
-- select * from public.evaluate_project_affordability('rincon-de-los-sauces', 60000, 20000, 0, null, 'contado');

commit;
-- rollback;

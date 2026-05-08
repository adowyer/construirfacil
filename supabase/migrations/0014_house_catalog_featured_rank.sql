-- 0014_house_catalog_featured_rank.sql
--
-- Agrega `featured_rank` (entero opcional) a house_catalog para destacar
-- modelos en el catálogo público.
--
-- Convención: valores menores aparecen primero (1 = más destacado). NULL
-- significa "no destacado". El sort público "Más Relevante" ordena por
-- featured_rank asc nulls last, y el footer (mini marquee) trae los N
-- primeros con featured_rank no null.
--
-- Idempotente.

alter table house_catalog
  add column if not exists featured_rank integer null;

create index if not exists house_catalog_featured_rank_idx
  on house_catalog (featured_rank)
  where featured_rank is not null;

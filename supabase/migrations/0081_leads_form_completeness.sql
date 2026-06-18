-- =============================================================================
-- 0081 — leads: completar columnas para que CADA campo del form UOCRA tenga la suya.
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit.
--
-- Decisión: cada campo del formulario de relevamiento = su propia columna (queryable),
-- además del form completo en profile_json. Datos como el anticipo/ahorro son
-- fundamentales para el análisis (cierran gaps; varios afiliados con $10M+).
-- =============================================================================
begin;

alter table public.leads add column if not exists has_escritura          boolean;   -- ¿Tiene escritura? (terreno propio escriturado)
alter table public.leads add column if not exists interested_casa_terreno boolean;  -- Si NO tiene terreno: ¿le interesa el plan Terreno + Casa?
alter table public.leads add column if not exists job_tenure_months       integer;  -- Antigüedad laboral (en meses)
alter table public.leads add column if not exists contract_type           text;     -- efectivo | temporario (subtipo de relación de dependencia)
alter table public.leads add column if not exists has_anticipo            boolean;  -- ¿Contás con un anticipo? (el monto va en savings_amount)
alter table public.leads add column if not exists form_date               date;     -- Fecha del formulario de relevamiento

alter table public.leads add constraint leads_contract_type_chk
  check (contract_type is null or contract_type in ('efectivo','temporario')) not valid;

comment on column public.leads.has_escritura is 'Terreno propio con escritura → ADUS más limpio/rápido.';
comment on column public.leads.contract_type is 'efectivo | temporario. employment_type (employed/self_employed) sigue siendo el que usa el motor; esto es el subtipo del form.';
comment on column public.leads.has_anticipo is '¿Contás con un anticipo? El monto aproximado va en savings_amount (ARS). Reduce el préstamo necesario y cierra gaps.';

select 'columnas form completas' chk, count(*) nuevas
  from information_schema.columns
 where table_schema='public' and table_name='leads'
   and column_name in ('has_escritura','interested_casa_terreno','job_tenure_months','contract_type','has_anticipo','form_date');

commit;
-- rollback;

-- =============================================================================
-- 0083 — leads: campos de la taxonomía canónica multi-canal.
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit, mirar VERIFICACIÓN.
--
-- Implementa la taxonomía de docs/leads_taxonomy.md:
--   • Eje 8 (Intención): horizonte_compra (+ driver de precio), seña (≠ anticipo, 2 campos).
--   • Eje 6 (Veredicto): blocker_code atómico + programa_recomendado (separa hecho/veredicto/programa).
-- Todo ADITIVO y nullable → no rompe filas existentes. El `blocker` de prosa queda deprecado en
-- favor de blocker_code + programa_recomendado (migrar el qualify_leads.sql es follow-up aparte).
-- =============================================================================
begin;

-- Eje 8 — Intención / Compromiso ---------------------------------------------
-- horizonte_compra: urgencia Y driver de tier de precio (3m=lista, 6m=cupo/contado, 12m=pozo).
alter table public.leads add column if not exists horizonte_compra text;
alter table public.leads add constraint leads_horizonte_compra_chk
  check (horizonte_compra is null or horizonte_compra in
         ('3_meses','6_meses','12_meses','+12m','sin_definir')) not valid;

-- seña = COMPROMISO de reserva (NO es el anticipo/ahorro, que es capacidad → savings_amount).
alter table public.leads add column if not exists sena_dispuesto boolean;
alter table public.leads add column if not exists sena_monto     numeric;

-- Eje 6 — Veredicto atómico ---------------------------------------------------
alter table public.leads add column if not exists blocker_code text;
alter table public.leads add constraint leads_blocker_code_chk
  check (blocker_code is null or blocker_code in
         ('tierra','escritura','codeudor','ingreso','ahorro','consentimiento','dato','ninguno')) not valid;

alter table public.leads add column if not exists programa_recomendado text;

comment on column public.leads.horizonte_compra is
  'Eje Intención. 3_meses=lista (más caro) | 6_meses=contado/CUPO | 12_meses=pozo (más barato). Driver de tier de precio.';
comment on column public.leads.sena_dispuesto is
  'Compromiso de reserva (≠ anticipo/ahorro). Señal de conversión / fondo de embudo.';
comment on column public.leads.blocker_code is
  'Bloqueante ATÓMICO (reemplaza el blocker de prosa): tierra/escritura/codeudor/ingreso/ahorro/consentimiento/dato/ninguno.';
comment on column public.leads.programa_recomendado is
  'Programa/línea recomendada (ADUS UVI 2%, banco X…). Detalle reemplazable, separado del blocker_code.';

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT)
-- -----------------------------------------------------------------------------
select 'columnas nuevas' chk, count(*) nuevas
  from information_schema.columns
 where table_schema='public' and table_name='leads'
   and column_name in ('horizonte_compra','sena_dispuesto','sena_monto','blocker_code','programa_recomendado');
-- Esperado: 5

commit;
-- rollback;

-- =============================================================================
-- 0079 — leads: resultado "ADUS si tuviera lote" (arma de negociación con UOCRA).
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit.
--
-- Por qué: los afiliados UOCRA NO tienen terreno → ADUS (que exige lote propio) queda
--   afuera HOY. Pero si tuvieran lote, ¿calificarían para ADUS (UVI+2%)? Saberlo da
--   vuelta la negociación: "tengo XX pre-calificados para ADUS, solo les falta la tierra
--   que ustedes pueden poner". Guardamos el resultado del escenario hipotético (has_lot=true)
--   como dato de primera clase para contar/pitchear.
--   (campaign_slug ya existe en leads desde 0039 — no se agrega.)
-- =============================================================================
begin;

alter table public.leads add column if not exists qualifies_adus_with_lot boolean;
alter table public.leads add column if not exists adus_loan_with_lot_usd numeric;

comment on column public.leads.qualifies_adus_with_lot is
  'TRUE si el lead calificaría para ADUS (Neuquén Habita, UVI+2%) SI tuviera lote propio. Escenario hipotético has_lot=true. Arma de negociación de tierra con UOCRA.';
comment on column public.leads.adus_loan_with_lot_usd is
  'Monto de crédito ADUS (USD) que obtendría con lote propio. NULL si no calificaría para ADUS aún con lote.';

select 'columnas ADUS-con-lote' chk, count(*) as nuevas
  from information_schema.columns
 where table_schema='public' and table_name='leads'
   and column_name in ('qualifies_adus_with_lot','adus_loan_with_lot_usd');

commit;
-- rollback;

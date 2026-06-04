-- =============================================================================
-- ConstruirFácil — leads.tiene_lote: contexto de lote del usuario
-- Migration: 0054_leads_tiene_lote.sql
-- =============================================================================
-- Capturamos en el lead si el usuario YA TIENE un lote propio o si necesita
-- buscar casa + lote. Esto es diferenciador estructural del producto:
-- ConstruirFácil ofrece desarrollos casa+lote con financiación dual (banco
-- financia tanto la construcción como el terreno). Saber esto en el lead
-- permite:
--   • a la marca: priorizar y proponer la solución correcta
--   • al cotizador (futuro #74): ofrecer la línea bancaria adecuada
--   • al equipo comercial: matchear con `lots_inventory` cuando el lead
--     busca casa+lote en una provincia con loteos activos
--
-- Valores:
--   • 'si'   → el usuario YA TIENE lote propio
--   • 'no'   → busca casa + lote (necesita terreno)
--   • NULL   → no respondió (default — no friccionamos al que no eligió)
--
-- IDEMPOTENTE. Sin default → leads existentes quedan NULL (nadie respondió).
-- =============================================================================

begin;

alter table public.leads
  add column if not exists tiene_lote text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_tiene_lote_check'
       and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_tiene_lote_check
      check (tiene_lote is null or tiene_lote in ('si', 'no'));
  end if;
end $$;

comment on column public.leads.tiene_lote is
  '''si'' → usuario tiene lote propio (solo necesita casa). ''no'' → busca casa+lote (oportunidad de cruzar con lots_inventory). NULL → no respondió.';

-- Índice para queries del tipo "interesados en casa+lote en provincia X":
--   select count(*) from leads where tiene_lote='no' and provincia_id=$1;
create index if not exists leads_tiene_lote_provincia_idx
  on public.leads (provincia_id, tiene_lote)
  where tiene_lote is not null;

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte)
-- =============================================================================
-- 1) Columna presente:
--    select column_name, data_type, is_nullable
--      from information_schema.columns
--     where table_schema='public' and table_name='leads' and column_name='tiene_lote';
--    Esperado: text, YES (null permitido).
--
-- 2) Constraint activa:
--    select conname, pg_get_constraintdef(oid)
--      from pg_constraint
--     where conrelid='public.leads'::regclass and conname='leads_tiene_lote_check';
--
-- 3) Leads existentes (no se les puso valor — quedan NULL):
--    select tiene_lote, count(*) from public.leads group by 1;
--    Esperado: NULL para los 6 leads viejos; 'si'/'no' empiezan a aparecer
--    cuando los users completen forms con el nuevo filtro.
-- =============================================================================

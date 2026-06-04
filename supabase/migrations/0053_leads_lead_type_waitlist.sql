-- =============================================================================
-- ConstruirFácil — leads.lead_type: distinguir "Quiero esta casa" de waitlist
-- Migration: 0053_leads_lead_type_waitlist.sql
-- =============================================================================
-- Hasta hoy, todos los leads venían del flow "Quiero esta casa" (modelo
-- específico + intención de compra). Habilitamos un segundo flow: "waitlist
-- por provincia" — usuario interesado en una marca que aún NO opera en su
-- provincia (zona excluded en marca_zonas). Promesa al cliente: "te
-- contactamos cuando lleguemos a tu provincia". Beneficio comercial: el
-- founder ve qué provincias generan demanda no satisfecha y puede decidir
-- abrir cupos donde se acumulan 10-15 interesados.
--
-- Decisión arquitectónica: una sola tabla `leads` con un campo `lead_type`,
-- en vez de una tabla `promo_interest` separada. Ventajas:
--   • El banner "Si sumamos N interesados abrimos cupo" del estado sin
--     programa (#13 promo_messages) cuenta directo desde `leads`, sin join.
--   • El pipeline de notificación (Resend + actualización de
--     notification_status) se reusa íntegro — varía solo el copy del email.
--   • La marca ve TODOS sus leads (compra inmediata + waitlist) en el
--     mismo lugar sin tener que merge-ear queries.
--
-- IDEMPOTENTE. `if not exists` + default no destructivo: leads existentes
-- (que son todos "quiero_esta_casa") quedan con ese valor por el default.
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Agregar la columna con default + check constraint
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists lead_type text
    not null
    default 'quiero_esta_casa';

-- Constraint en una sentencia separada para que sea idempotente sobre
-- pg_constraint. La hacemos con `add constraint if not exists` vía DO block
-- porque Postgres no soporta IF NOT EXISTS en check constraints directos.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_lead_type_check'
       and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_lead_type_check
      check (lead_type in ('quiero_esta_casa', 'waitlist_provincia'));
  end if;
end $$;

comment on column public.leads.lead_type is
  'Tipo de lead: ''quiero_esta_casa'' (intención de compra de modelo específico) vs ''waitlist_provincia'' (interés en marca que aún no opera en su provincia — esperan apertura de cupos). El banner por provincia cuenta directamente de acá.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Índice compuesto para el contador del banner por provincia
-- ─────────────────────────────────────────────────────────────────────────────
-- Query típica del banner sin programa:
--   select count(*) from leads
--    where marca_id = $1 and provincia_id = $2 and lead_type = 'waitlist_provincia';
-- El índice cubre exact match + count.
create index if not exists leads_waitlist_count_idx
  on public.leads (marca_id, provincia_id, lead_type)
  where lead_type = 'waitlist_provincia';

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr aparte)
-- =============================================================================
-- 1) Columna presente con default correcto:
--    select column_name, data_type, is_nullable, column_default
--      from information_schema.columns
--     where table_schema='public' and table_name='leads' and column_name='lead_type';
--    Esperado: text, NO, 'quiero_esta_casa'.
--
-- 2) Constraint activa:
--    select conname, pg_get_constraintdef(oid)
--      from pg_constraint
--     where conrelid='public.leads'::regclass and conname='leads_lead_type_check';
--
-- 3) Leads existentes con default aplicado:
--    select lead_type, count(*) from public.leads group by 1;
--    Esperado: todos en 'quiero_esta_casa' (cero 'waitlist_provincia' hasta
--    que se complete el primer form).
-- =============================================================================

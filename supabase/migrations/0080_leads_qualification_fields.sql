-- =============================================================================
-- ConstruirFácil — leads: campos de calificación (apellido, timeframe, ahorro)
-- Migration: 0080_leads_qualification_fields.sql
-- =============================================================================
-- "Quiero esta casa" hoy = nombre+teléfono+localidad+mensaje. Belen llegó con
-- todo eso, pero al equipo de ventas le falta data para PRIORIZAR/EVALUAR el
-- lead. Hasta que Ximia esté en producción, el form mismo tiene que pedir lo
-- mínimo accionable.
--
-- Cambios:
--   1) `apellido text` — separado de `name` para CRM/HubSpot/mail formal.
--   2) `timeframe text` — '3m' / '6m' / '1y'. Define urgencia + plan de seguimiento.
--   3) `ahorro_ars_range text` — rango de ahorro propio en ARS (opcional). 5
--      tramos pre-armados; "Aún no" disfraza el tabú de dar números.
--
-- `tiene_lote` ya existía y queda como está (sí/no, sin tocar).
--
-- Idempotente. Aplicar en bloques en el SQL editor de Supabase.
-- =============================================================================

-- ── 1) apellido ─────────────────────────────────────────────────────────────
alter table public.leads add column if not exists apellido text;

comment on column public.leads.apellido is
  'Apellido del lead — separado de `name` (que conservamos como "nombre y apellido" para compat histórica).';

-- ── 2) timeframe ────────────────────────────────────────────────────────────
alter table public.leads add column if not exists timeframe text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_timeframe_check'
       and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_timeframe_check
      check (timeframe is null or timeframe in ('3m', '6m', '1y'));
  end if;
end $$;

comment on column public.leads.timeframe is
  '''3m'' / ''6m'' / ''1y'' — cuándo querría tener la casa terminada. Define urgencia del seguimiento y plan financiero.';

-- ── 3) ahorro_ars_range ─────────────────────────────────────────────────────
alter table public.leads add column if not exists ahorro_ars_range text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_ahorro_ars_range_check'
       and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_ahorro_ars_range_check
      check (
        ahorro_ars_range is null
        or ahorro_ars_range in ('none', 'lt_10m', '10m_30m', '30m_60m', '60m_plus')
      );
  end if;
end $$;

comment on column public.leads.ahorro_ars_range is
  'Rango de ahorro propio en ARS declarado por el lead: ''none'' (aún no) / ''lt_10m'' (<10M) / ''10m_30m'' / ''30m_60m'' / ''60m_plus''. OPCIONAL — no bloquear si está vacío.';

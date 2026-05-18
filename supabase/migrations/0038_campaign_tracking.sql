-- =============================================================================
-- ConstruirFácil — campaign_event (libro mayor de medición)
-- Migration: 0038_campaign_tracking.sql
-- =============================================================================
-- Ledger append-only de eventos de campaña. Fuente de verdad propia (GA4
-- subcuenta por adblock/consent y acá se gasta plata real). "Visitas" =
-- session_id distintos con event_type='landing_view' por campaign_slug.
--
-- OJO — política INVERSA a las tablas de contenido (0030/0031): esto es
-- DATA INTERNA. NO se otorga select a anon/authenticated y NO hay policy:
-- todo acceso (escritura del beacon y lectura del dashboard) va por
-- service-role (createAdminClient bypassa RLS). Que sea world-readable
-- filtraría métricas de negocio.
--
-- Idempotente. Correr en BLOQUES en el editor SQL de Supabase
-- (tabla / índices / rls+revoke) — multi-statement revierte todo si falla.
-- =============================================================================

create table if not exists public.campaign_event (
  id            uuid primary key default gen_random_uuid(),
  campaign_slug text,                          -- null = evento sin campaña (baseline)
  session_id    text,                          -- cookie cf_sid (anónima, no PII)
  event_type    text not null
                  check (event_type in
                    ('landing_view','model_open','cotizar_open',
                     'whatsapp_click','lead')),
  utm_source    text,                          -- el medio
  utm_medium    text,
  utm_campaign  text,                          -- la ola (roll-up)
  utm_content   text,                          -- = slug (llave de atribución)
  utm_term      text,                          -- variante de creativo
  referrer      text,
  path          text,
  meta          jsonb,                         -- ej. { model: 'bosque-ambay-t1' }
  created_at    timestamptz not null default now()
);

comment on table public.campaign_event is
  'Ledger de eventos de campaña (append-only). DATA INTERNA: sin grant a anon/authenticated, acceso sólo service-role.';

create index if not exists campaign_event_slug_idx
  on public.campaign_event (campaign_slug, created_at);
create index if not exists campaign_event_type_idx
  on public.campaign_event (event_type, created_at);
create index if not exists campaign_event_session_idx
  on public.campaign_event (session_id);

-- Tabla INTERNA: RLS on, sin policy, sin grant público. Service-role bypassa.
alter table public.campaign_event enable row level security;
revoke all on table public.campaign_event from anon, authenticated;

-- =============================================================================
-- select campaign_slug, event_type, count(*) from public.campaign_event
--   group by 1,2 order by 1,2;
-- =============================================================================

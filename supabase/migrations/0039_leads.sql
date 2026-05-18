-- =============================================================================
-- ConstruirFácil — leads
-- Migration: 0039_leads.sql
-- =============================================================================
-- Cierre del loop (Fase 4): conversión REAL y medible. El form de /cotizar
-- escribe acá vía service-role, con la atribución de campaña (campaign_slug +
-- utm_*) resuelta server-side desde las cookies cf_camp/cf_utm. Esto es lo
-- que permite costo-por-lead por banner (cruzando con campaign_event).
--
-- DATA INTERNA + PII (nombre/teléfono): igual que campaign_event, RLS on,
-- SIN grant a anon/authenticated, SIN policy. Sólo service-role.
--
-- Idempotente. Correr en BLOQUES en el editor SQL de Supabase.
-- =============================================================================

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text not null,
  email         text,
  localidad     text,
  message       text,
  campaign_slug text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  path          text,
  status        text not null default 'new'
                  check (status in ('new','contacted','won','lost')),
  created_at    timestamptz not null default now()
);

comment on table public.leads is
  'Leads del form de /cotizar. PII + atribución de campaña. Acceso sólo service-role (sin grant público).';

create index if not exists leads_campaign_idx
  on public.leads (campaign_slug, created_at);
create index if not exists leads_status_idx
  on public.leads (status, created_at);

alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated;

-- =============================================================================
-- select campaign_slug, status, count(*) from public.leads group by 1,2;
-- =============================================================================

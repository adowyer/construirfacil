-- =============================================================================
-- ConstruirFácil — Tracking de sync con HubSpot CRM
-- Migration: 0067_leads_hubspot_sync_tracking.sql
-- =============================================================================
-- Agregamos columnas a leads para llevar el estado de sincronización con
-- HubSpot. El sub-workflow n8n "CF Leads → HubSpot Sync" las consulta y
-- actualiza cada 1 min: filtra por synced_hubspot_at IS NULL para idempotencia
-- y guarda el vid del contact en synced_hubspot_id.
-- =============================================================================

alter table public.leads add column if not exists synced_hubspot_at timestamptz;
alter table public.leads add column if not exists synced_hubspot_id text;
alter table public.leads add column if not exists sync_error text;

-- Índice parcial: queries de "leads pendientes de sync" son las más frecuentes
-- en el flow n8n. El partial index las hace ~instantáneas sin penalizar el resto.
create index if not exists leads_pending_sync_idx
  on public.leads (created_at)
  where synced_hubspot_at is null;

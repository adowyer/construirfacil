-- 0088_leads_unsubscribed.sql
-- Baja (unsubscribe) de email comercial — Ley 25.326 (derecho a baja) + deliverability.
-- La ruta /unsubscribe (one-click, token firmado) la setea; el script de envío EXCLUYE
-- unsubscribed=true. NUNCA re-mailear a un lead dado de baja.
-- DDL: la corre Andrea a mano.

alter table public.leads
  add column if not exists unsubscribed     boolean not null default false,
  add column if not exists unsubscribed_at  timestamptz;

comment on column public.leads.unsubscribed is
  'El lead pidió la baja de emails comerciales (one-click /unsubscribe). El envío lo excluye. NUNCA re-mailear si true.';

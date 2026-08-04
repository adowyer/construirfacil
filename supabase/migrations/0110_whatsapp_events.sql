-- 0110_whatsapp_events.sql
--
-- POR QUÉ EXISTE
-- Meta devuelve 200 cuando ACEPTA un mensaje, no cuando lo ENTREGA. Sin este ledger,
-- una tanda de 321 WhatsApps "sale bien" y nadie sabe cuántos llegaron, cuántos
-- rebotaron y cuántos bloquearon el número. Es la misma falla muda que una ejecución
-- de n8n en `success` sin fila escrita: el éxito del transporte no es el éxito del hecho.
--
-- Lo llena `app/api/whatsapp/webhook/route.ts` (ruta de CF en Vercel, NO n8n: WhatsApp
-- dispara un evento por mensaje POR ESTADO — enviado/entregado/leído — y una tanda de
-- 321 leads son >1.000 ejecuciones. n8n se paga por ejecución).

create table if not exists public.whatsapp_events (
  id           uuid primary key default gen_random_uuid(),

  -- 'status'  = cambio de estado de un mensaje que mandamos nosotros
  -- 'inbound' = mensaje que nos mandó la persona
  kind         text not null check (kind in ('status', 'inbound')),

  wamid        text,                 -- id del mensaje en WhatsApp
  wa_phone     text not null,        -- número de la contraparte, solo dígitos
  phone_key    text not null,        -- últimos 8 dígitos — MISMA regla que norm_phone()
                                     -- en scripts/sync_hubspot_to_supabase.py
  lead_id      uuid references public.leads (id) on delete set null,

  status       text,                 -- sent | delivered | read | failed
  error_code   int,
  error_title  text,
  body         text,                 -- texto del mensaje entrante

  occurred_at  timestamptz not null,
  raw          jsonb not null,       -- payload crudo: si mañana falta un campo, está acá
  created_at   timestamptz not null default now(),

  -- Clave de idempotencia: `<wamid>:<kind>:<status|''>`, armada en la ruta.
  -- Es una columna real y no un índice con coalesce() a propósito: así se puede
  -- usar como destino de `upsert(..., onConflict: 'dedupe_key')`. Un índice sobre
  -- una expresión no sirve para eso, y un unique sobre (wamid, kind, status) NO
  -- deduplica los entrantes, porque en SQL dos NULL nunca chocan.
  dedupe_key   text not null
);

-- Idempotencia: Meta REINTENTA los webhooks. Sin esto, un reintento duplica filas y
-- las métricas de entrega mienten hacia arriba.
create unique index if not exists whatsapp_events_dedup
  on public.whatsapp_events (dedupe_key);

create index if not exists whatsapp_events_phone_key on public.whatsapp_events (phone_key);
create index if not exists whatsapp_events_lead      on public.whatsapp_events (lead_id);
create index if not exists whatsapp_events_occurred  on public.whatsapp_events (occurred_at desc);

comment on table public.whatsapp_events is
  'Ledger de WhatsApp Cloud API: estados de entrega y mensajes entrantes. Un 200 de Meta significa ACEPTADO, no ENTREGADO — la entrega real solo se sabe acá.';

comment on column public.whatsapp_events.phone_key is
  'Últimos 8 dígitos del teléfono. MISMA regla que norm_phone() del sync de HubSpot — no crear una segunda.';

-- RLS: tabla interna, se escribe con service_role desde la ruta. Nadie más la toca.
alter table public.whatsapp_events enable row level security;

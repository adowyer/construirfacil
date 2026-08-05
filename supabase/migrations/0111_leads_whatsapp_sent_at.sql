-- 0111_leads_whatsapp_sent_at.sql
--
-- POR QUÉ UNA COLUMNA APARTE Y NO REUSAR engagement_sent_at
-- `engagement_sent_at` es el PRIMER touch comercial, sea por el canal que sea, y
-- `engagement_channel` (0087) ya contempla 'whatsapp'. Pero si el envío de WhatsApp
-- marcara `engagement_sent_at`, el guard de idempotencia excluiría a los 40 leads que
-- YA recibieron el mail — que son justamente a quienes más les sirve el WhatsApp,
-- porque el mail es el canal que no les funciona (3% verificado, direcciones de OCR).
--
-- Reparto:
--   engagement_sent_at / engagement_channel → el PRIMER contacto, cualquiera sea.
--   whatsapp_sent_at                        → el envío de la plantilla de WhatsApp.
-- Un lead puede tener los dos, y eso NO es una contradicción: es el mismo lead
-- alcanzado dos veces por canales distintos.

alter table public.leads
  add column if not exists whatsapp_sent_at timestamptz;

comment on column public.leads.whatsapp_sent_at is
  'Cuándo se le mandó la plantilla de WhatsApp. Guard de idempotencia del sender: NULL = todavía no se le mandó. Independiente de engagement_sent_at, que es el primer touch comercial por cualquier canal.';

create index if not exists leads_whatsapp_pendientes
  on public.leads (whatsapp_sent_at)
  where whatsapp_sent_at is null;

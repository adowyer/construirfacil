-- 0087_leads_engagement_sent_at.sql
--
-- Idempotencia del engagement outbound (mail/WhatsApp del primer touch).
-- El envío es IRREVERSIBLE: necesitamos un marcador por lead para no escribirle
-- dos veces si el script de envío se corre más de una vez. El batch envía solo
-- WHERE engagement_sent_at is null y setea el timestamp al enviar OK.
--
-- DDL: la corre Andrea a mano (Ximia/n8n no hace DDL).

alter table public.leads
  add column if not exists engagement_sent_at timestamptz,
  add column if not exists engagement_channel  text;  -- 'email' | 'whatsapp' | 'manual'

comment on column public.leads.engagement_sent_at is
  'Timestamp del primer touch comercial enviado (engagement). NULL = todavía no contactado. Guard de idempotencia del envío.';
comment on column public.leads.engagement_channel is
  'Canal del primer touch: email | whatsapp | manual.';

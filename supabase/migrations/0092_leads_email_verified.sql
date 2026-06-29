-- 0092_leads_email_verified.sql
--
-- Verificación de email (doble opt-in) del proceso de postulación.
-- El lead recibe el mail de VERIFICACIÓN (primer touch, gateado por
-- engagement_sent_at 0087) → pulsa "Verificar mi cuenta" → la ruta /verify
-- (token firmado, espejo de /unsubscribe) marca email_verified_at y dispara
-- el mail de BIENVENIDA (una sola vez, gateado por welcome_sent_at).
--
-- email_verified_at  = cuándo el lead confirmó su registro (click en el link).
-- welcome_sent_at    = guard de idempotencia del mail de bienvenida (la ruta
--                      puede recibir más de un click; la bienvenida sale UNA vez).
--
-- DDL: la corre Andrea a mano (Ximia/n8n no hace DDL).

alter table public.leads
  add column if not exists email_verified_at timestamptz,
  add column if not exists welcome_sent_at   timestamptz;

comment on column public.leads.email_verified_at is
  'El lead confirmó su registro pulsando el link de verificación (/verify, token firmado). NULL = todavía no verificó.';
comment on column public.leads.welcome_sent_at is
  'Timestamp del mail de bienvenida (se dispara al verificar). Guard de idempotencia: la bienvenida sale una sola vez.';

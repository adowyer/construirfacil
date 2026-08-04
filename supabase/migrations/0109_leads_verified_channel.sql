-- 0109_leads_verified_channel.sql
--
-- POR QUÉ EXISTE ESTA COLUMNA
-- Hasta hoy, confirmar el registro era una sola cosa: clickear el link del mail.
-- Desde 2026-08-04 el lead también puede confirmar desde el botón de la plantilla
-- de WhatsApp (ver docs/whatsapp/PLANTILLAS.md). Sin esta columna, `email_verified_at`
-- pasaría a marcarse por una acción que no tiene nada que ver con el email — un campo
-- que dice una cosa y guarda otra. Es la misma forma del bug de `first_home`: el dato
-- estaba, la regla estaba, y se perdió en el cable entre los dos.
--
-- Reparto: `email_verified_at` = CUÁNDO confirmó. `verified_channel` = POR DÓNDE.

alter table public.leads
  add column if not exists verified_channel text;

alter table public.leads
  drop constraint if exists leads_verified_channel_check;

alter table public.leads
  add constraint leads_verified_channel_check
  check (verified_channel is null or verified_channel in ('email', 'whatsapp'));

-- Backfill: todo el que ya confirmó, lo hizo por el link del mail — era el único
-- camino que existía. Sin esto, un NULL en una fila verificada se leería como
-- "todavía no confirmó", que es falso.
update public.leads
   set verified_channel = 'email'
 where email_verified_at is not null
   and verified_channel is null;

comment on column public.leads.verified_channel is
  'Canal por el que el lead confirmó su registro: email (link del mail) | whatsapp (botón de la plantilla Utility). NULL = todavía no confirmó. El CUÁNDO vive en email_verified_at.';

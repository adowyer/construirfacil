-- =============================================================================
-- ConstruirFácil — Leads "Quiero esta casa" + contacto por marca
-- Migration: 0049_leads_quiero_esta_casa.sql
-- =============================================================================
-- El flujo "Quiero esta casa" del catálogo manda al usuario a una modal con:
--   1) Cotizador (precio + cuota) como anclaje visual (ya existe).
--   2) Form de captura con datos de la casa elegida + datos del usuario.
--   3) Submit → registra el lead en `leads` + dispara email al cliente y a la
--      marca + ofrece "Hablá ahora por WhatsApp" como salida emocional.
--
-- Esta migración extiende dos tablas:
--   • `leads`: campos del modelo/variante/SC + provincia normalizada — para
--     que la marca reciba qué pidió exactamente y nuestro admin pueda filtrar.
--   • `marcas`: WhatsApp + email de notificación — para que el destino del
--     mail y del link de WA sea per-marca, no hardcoded.
--
-- IDEMPOTENTE.
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) marcas: contacto al que llega el lead
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.marcas
  add column if not exists whatsapp_number          text,
  add column if not exists lead_notification_email  text;

comment on column public.marcas.whatsapp_number is
  'Número de WhatsApp de la marca para el CTA "Hablá ahora" del lead. Formato libre; el link se construye sin el "+" y sin espacios.';
comment on column public.marcas.lead_notification_email is
  'Email al que se notifican los leads "Quiero esta casa" de esta marca.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) leads: contexto de la casa pedida
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists marca_id              uuid
    references public.marcas(id) on delete set null,
  add column if not exists model_slug            text,
  add column if not exists style_name            text,
  add column if not exists tipologia_code_new    text,
  add column if not exists variante              text,
  add column if not exists sistema_constructivo  text,
  add column if not exists provincia_id          uuid
    references public.provincias(id) on delete set null,
  add column if not exists notification_status   text
    not null default 'pending'
    check (notification_status in ('pending','sent','failed','skipped'));

comment on column public.leads.marca_id is
  'Marca a la que apunta el lead (FK marcas). NULL para leads viejos del form genérico /cotizar.';
comment on column public.leads.model_slug is
  'group_slug del modelo elegido (linea+tipologia_code_new+style_name).';
comment on column public.leads.style_name is
  'Nombre del modelo (ALECRIN, PAMPA, ...) — denormalizado para reportes sin join.';
comment on column public.leads.tipologia_code_new is
  'NODO/DECK/ZETA/EJE/etc — denormalizado.';
comment on column public.leads.variante is
  'Variante seleccionada en el comparativo (ej. "2", "3.1").';
comment on column public.leads.sistema_constructivo is
  'SC elegido en el cotizador (Wood Plus, Steel Plus, Stone Plus).';
comment on column public.leads.provincia_id is
  'Provincia normalizada (FK provincias) — más confiable que el text de `localidad`.';
comment on column public.leads.notification_status is
  'Estado del envío de mail tras crear el lead. Permite reintentos asíncronos sin perder el lead si Resend falla.';

create index if not exists leads_marca_idx
  on public.leads (marca_id, created_at desc);
create index if not exists leads_notification_idx
  on public.leads (notification_status, created_at)
  where notification_status in ('pending','failed');

commit;

-- =============================================================================
-- Sanity checks:
--   select column_name, data_type from information_schema.columns
--     where table_name='leads' and column_name in
--       ('marca_id','model_slug','style_name','tipologia_code_new',
--        'variante','sistema_constructivo','provincia_id','notification_status');
--   select column_name, data_type from information_schema.columns
--     where table_name='marcas' and column_name in
--       ('whatsapp_number','lead_notification_email');
-- =============================================================================

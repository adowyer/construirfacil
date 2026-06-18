-- =============================================================================
-- 0074 — leads enriquecida: que Ximia (chat) y el OCR (forms UOCRA) escriban acá.
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit, mirar VERIFICACIÓN.
--
-- Reusa la tabla `leads` (0039, ya sincroniza a HubSpot vía 0067) — NO una 4ª tabla.
-- MVP launch: identidad + campos del form UOCRA + calificación + snapshots jsonb.
-- El dossier rico (scoring FIT×INTENT, next_action, verbatims) va en intelligence_json
-- cuando exista el Lead Synthesizer (post-MVP) — no se sobre-construye ahora.
-- =============================================================================
begin;

-- name/phone dejan de ser obligatorios: el chat persiste progresivo (sin contacto aún)
-- y un form UOCRA puede venir parcial. El /cotizar web los sigue mandando a nivel app.
alter table public.leads alter column name  drop not null;
alter table public.leads alter column phone drop not null;

-- Origen + sesión + consentimiento
alter table public.leads add column if not exists source text not null default 'web_form'
  check (source in ('web_chat','sindicato_uocra','web_form'));
alter table public.leads add column if not exists session_id text;
alter table public.leads add column if not exists user_id uuid;            -- identidad (rehidratar al que vuelve)
alter table public.leads add column if not exists consent_captured_at timestamptz;

-- Identidad ampliada (UOCRA + chat)
alter table public.leads add column if not exists dni text;
alter table public.leads add column if not exists cuil text;
alter table public.leads add column if not exists fecha_nacimiento date;
alter table public.leads add column if not exists age integer;
alter table public.leads add column if not exists estado_civil text;

-- Atribución UOCRA
alter table public.leads add column if not exists delegado text;
alter table public.leads add column if not exists seccional text;

-- Perfil (hechos duros, queryables para scoring/CRM)
alter table public.leads add column if not exists province text;
alter table public.leads add column if not exists has_lot boolean;
alter table public.leads add column if not exists first_home boolean;
alter table public.leads add column if not exists residency_years integer;
alter table public.leads add column if not exists employment_type text;
alter table public.leads add column if not exists monthly_income_ars numeric;
alter table public.leads add column if not exists partner_income_ars numeric;
alter table public.leads add column if not exists codeudor boolean;
alter table public.leads add column if not exists savings_amount numeric;
alter table public.leads add column if not exists savings_currency text;
alter table public.leads add column if not exists alquila boolean;
alter table public.leads add column if not exists alquiler_amount numeric;
alter table public.leads add column if not exists family_size integer;
alter table public.leads add column if not exists buyer_type text;          -- familia | inversor (el FORK)

-- Calificación (resultado de los tools)
alter table public.leads add column if not exists qualifies boolean;
alter table public.leads add column if not exists bucket text;             -- READY | READY_BLOCKED | QUALIFIES_LATER | NOT_A_FIT
alter table public.leads add column if not exists blocker text;            -- el bloqueante específico
alter table public.leads add column if not exists financial_path text;     -- adus | casa_lote_viable | waitlist | no_loteo
alter table public.leads add column if not exists resolved_sku text;
alter table public.leads add column if not exists model_name text;
alter table public.leads add column if not exists loan_usd numeric;
alter table public.leads add column if not exists monthly_payment_ars numeric;
alter table public.leads add column if not exists funding_gap_usd numeric;
alter table public.leads add column if not exists gap_financeable boolean;

-- Snapshots
alter table public.leads add column if not exists profile_json jsonb;      -- la ficha completa
alter table public.leads add column if not exists intelligence_json jsonb; -- el dossier (Synthesizer, post-MVP)

-- Lifecycle / seguimiento
alter table public.leads add column if not exists next_contact_date date;
alter table public.leads add column if not exists re_engagement_trigger text;
alter table public.leads add column if not exists updated_at timestamptz default now();

-- Upsert idempotente del chat por sesión. (UOCRA dedup por dni se maneja en el ingest.)
create unique index if not exists leads_session_id_uidx
  on public.leads (session_id) where session_id is not null;

comment on column public.leads.source is 'web_chat (Ximia) | sindicato_uocra (form OCR) | web_form (/cotizar)';
comment on column public.leads.intelligence_json is 'Dossier del Lead Synthesizer (sentiment, drivers, scoring FIT×INTENT, next_action, verbatims). Vacío hasta que exista el worker.';

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT)
-- -----------------------------------------------------------------------------
select 'columnas nuevas' chk, count(*) as nuevas
  from information_schema.columns
 where table_schema='public' and table_name='leads'
   and column_name in ('source','session_id','bucket','profile_json','intelligence_json','buyer_type','blocker');

-- name/phone ahora nullable:
select 'name/phone nullable' chk, is_nullable
  from information_schema.columns where table_schema='public' and table_name='leads' and column_name='name';

commit;
-- rollback;

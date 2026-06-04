-- =============================================================================
-- ConstruirFácil — Baseline catch-up: tablas Ximia-side (motor agente/financiero)
-- Migration: 0050_baseline_ximia_tables.sql
-- =============================================================================
-- Estas 12 tablas viven en la MISMA Supabase que CF pero se habían creado a mano
-- (lado XIMIA/n8n), fuera del historial de migraciones. Esta migración las
-- captura con su definición REAL (dump de esquema 2026-05-31) para que el repo
-- sea la única fuente de verdad y un rebuild desde cero funcione.
--
-- A partir de acá: ningún cambio de esquema se hace a mano. Todo entra como
-- migración numerada en este repo. n8n/Ximia solo lee/escribe filas (no DDL).
--
-- Estado capturado = PRE-Geo Layer (construction_quotas y banks_financing aún
-- sin columnas geo). La 0051 les agrega marca_id/provincia_id/margin_pool/etc.
--
-- NOTA SEGURIDAD: ninguna de estas 12 tablas tiene RLS ni triggers hoy
-- (la ④ del relevamiento volvió vacía). Revisar políticas RLS por separado;
-- son accesibles vía service_role del agente.
--
-- IDEMPOTENTE (create table if not exists + FKs/índices guardados).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- INFRA / DOMINIO
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid not null default gen_random_uuid(),
  email text,
  name text,
  phone text,
  source text,
  lead_status text default 'new'::text,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now(),
  constraint users_pkey PRIMARY KEY (id),
  constraint users_email_key UNIQUE (email)
);

create table if not exists public.projects (
  id uuid not null default gen_random_uuid(),
  project_name text not null,
  project_slug text not null,
  city text,
  region text,
  country text default 'Argentina'::text,
  project_type text,
  description text,
  is_active boolean default true,
  created_at timestamp without time zone default now(),
  minimum_units_to_start integer not null default 0,
  private_can_cover_lot boolean not null default true,
  lot_map_public_url text,
  construction_features_markdown text,
  marketing_content jsonb default '{}'::jsonb,
  constraint projects_pkey PRIMARY KEY (id),
  constraint projects_project_slug_key UNIQUE (project_slug)
);

create table if not exists public.system_config (
  key text not null,
  value text,
  constraint system_config_pkey PRIMARY KEY (key)
);

-- -----------------------------------------------------------------------------
-- MOTOR FINANCIERO
-- -----------------------------------------------------------------------------
create table if not exists public.banks_financing (
  id uuid not null default gen_random_uuid(),
  bank_name text not null,
  product_name text,
  loan_type text,
  destination text,
  max_financing_pct numeric,
  max_term_months integer,
  interest_rate numeric,
  interest_adjustment text,
  currency text default 'ARS'::text,
  is_active boolean default true,
  created_at timestamp without time zone default now(),
  max_loan_amount_ars numeric,
  constraint banks_financing_pkey PRIMARY KEY (id)
);

create table if not exists public.construction_quotas (
  id uuid not null default gen_random_uuid(),
  project_id uuid,
  quota_code text,
  start_month date,
  total_slots integer,
  available_slots integer,
  status text,
  created_at timestamp without time zone default now(),
  constraint construction_quotas_pkey PRIMARY KEY (id),
  constraint construction_quotas_quota_code_key UNIQUE (quota_code)
);

create table if not exists public.financial_matrix (
  id uuid not null default gen_random_uuid(),
  rule_id text,
  min_gap_pct numeric,
  max_gap_pct numeric,
  priority integer default 1,
  strategy_name text,
  ai_instruction text,
  is_active boolean default true,
  created_at timestamp without time zone default now(),
  constraint financial_matrix_pkey PRIMARY KEY (id),
  constraint financial_matrix_rule_id_key UNIQUE (rule_id)
);

create table if not exists public.private_financing_commitments (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  conversation_id text,
  session_id text,
  amount_usd_committed numeric not null,
  status text not null default 'pending'::text,
  house_catalog_id uuid,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint private_financing_commitments_amount_usd_committed_check CHECK ((amount_usd_committed >= (0)::numeric)),
  constraint private_financing_commitments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'released'::text, 'cancelled'::text]))),
  constraint private_financing_commitments_pkey PRIMARY KEY (id)
);

create table if not exists public.lots_inventory (
  id uuid not null default gen_random_uuid(),
  project_id uuid,
  lot_code text,
  sector text,
  view_type text,
  area_m2 numeric,
  price_usd numeric,
  status text default 'Available'::text,
  blocked_until timestamp without time zone,
  assigned_lead_email text,
  created_at timestamp without time zone default now(),
  constraint lots_inventory_pkey PRIMARY KEY (id),
  constraint lots_inventory_lot_code_key UNIQUE (lot_code)
);

-- -----------------------------------------------------------------------------
-- CONVERSACIÓN / AGENTE
-- -----------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid not null default gen_random_uuid(),
  session_id text not null,
  conversation_id text,
  user_id uuid,
  nombre text,
  email text,
  telefono text,
  auth_status text default 'unverified'::text,
  current_goal text,
  current_step text,
  phase text default 'discovery'::text,
  ficha_json jsonb,
  conversation_log text,
  sentiment_score numeric,
  buyer_intent text,
  lifestyle_tags text[],
  lead_score integer,
  lead_priority text,
  contactable boolean,
  score_reasons text[],
  recommended_model text,
  funding_gap_usd numeric,
  gap_financeable boolean,
  gap_checked_at timestamp with time zone,
  gap_recheck_eligible boolean default true,
  origin_host text,
  origin_url text,
  project_interest text default 'posadas_al_rio'::text,
  status text default 'active'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  gap_pct numeric,
  affordability_calc_version text,
  affordability_snapshot text,
  private_headroom_usd numeric,
  constraint conversations_pkey PRIMARY KEY (id),
  constraint conversations_conversation_id_key UNIQUE (conversation_id),
  constraint conversations_session_id_key UNIQUE (session_id)
);

create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid,
  sender text,
  message_text text,
  message_metadata jsonb,
  created_at timestamp without time zone default now(),
  constraint messages_pkey PRIMARY KEY (id)
);

create table if not exists public.lead_qualification (
  qualification_id uuid not null default gen_random_uuid(),
  session_id text,
  user_id uuid,
  conversation_id text,
  financial_score integer,
  engagement_score integer,
  urgency_score integer,
  total_score integer,
  qualification_tier text,
  buyer_profile text,
  household_type text,
  communication_profile text,
  top_match_model text,
  funding_gap_usd numeric,
  gap_financeable boolean,
  recommended_action text,
  next_contact_date date,
  qualification_date timestamp with time zone default now(),
  constraint lead_qualification_pkey PRIMARY KEY (qualification_id)
);

create table if not exists public.property_matches (
  id uuid not null default gen_random_uuid(),
  conversation_id text,
  project_id uuid,
  house_model_code text,
  lot_id uuid,
  recommended_rank integer,
  match_score numeric,
  created_at timestamp without time zone default now(),
  constraint property_matches_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- FOREIGN KEYS (después de crear todas las tablas; idempotentes)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'construction_quotas_project_id_fkey') then
    alter table public.construction_quotas
      add constraint construction_quotas_project_id_fkey
      foreign key (project_id) references public.projects(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'conversations_user_id_fkey') then
    alter table public.conversations
      add constraint conversations_user_id_fkey
      foreign key (user_id) references public.users(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_qualification_session_id_fkey') then
    alter table public.lead_qualification
      add constraint lead_qualification_session_id_fkey
      foreign key (session_id) references public.conversations(session_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_qualification_user_id_fkey') then
    alter table public.lead_qualification
      add constraint lead_qualification_user_id_fkey
      foreign key (user_id) references public.users(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lots_inventory_project_id_fkey') then
    alter table public.lots_inventory
      add constraint lots_inventory_project_id_fkey
      foreign key (project_id) references public.projects(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'private_financing_commitments_project_id_fkey') then
    alter table public.private_financing_commitments
      add constraint private_financing_commitments_project_id_fkey
      foreign key (project_id) references public.projects(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'property_matches_project_id_fkey') then
    alter table public.property_matches
      add constraint property_matches_project_id_fkey
      foreign key (project_id) references public.projects(id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- ÍNDICES (no respaldan PK/unique)
-- -----------------------------------------------------------------------------
create index if not exists idx_conv_email           on public.conversations using btree (email);
create index if not exists idx_conv_gap_recheck      on public.conversations using btree (gap_recheck_eligible, funding_gap_usd) where (gap_recheck_eligible = true);
create index if not exists idx_conv_lead_priority    on public.conversations using btree (lead_priority);
create index if not exists idx_conv_user_id          on public.conversations using btree (user_id);
create index if not exists idx_pfc_project_active    on public.private_financing_commitments using btree (project_id) where (status = ANY (ARRAY['pending'::text, 'confirmed'::text]));

commit;

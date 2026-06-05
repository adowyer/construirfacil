-- =============================================================================
-- ConstruirFácil — Auth gate del catálogo: OTP email verification
-- Migration: 0061_email_verifications_auth_gate.sql
-- =============================================================================
-- Bloquea el catálogo público hasta que el visitante ingrese email + nombre y
-- verifique con un código de 4 dígitos. Captura leads desde el day-one del
-- lanzamiento a Neuquén y evita que la competencia espíe el catálogo entero.
--
-- Arquitectura compartida con Ximia (n8n): comparten la DB Supabase.
--   • CF inserta en public.users (mismo upsert pattern de Ximia → idempotente
--     por email UNIQUE en users).
--   • Ximia chequea si ya hay row en users por email → no le pide registro de
--     nuevo (a coordinar con el flow n8n; ver Decision Engine, key
--     profile.state.auth.status).
--
-- Decisiones:
--   • Tabla nueva email_verifications (no reusamos conversations de Ximia
--     porque CF es flow web, no chat). Más limpio + drop sin romper Ximia.
--   • TTL 10 min (otp_expires_at).
--   • Max 5 intentos por code (otp_attempts).
--   • OTP de 4 dígitos string (consistente con Ximia).
--   • users gana 2 columnas: email_verified_at + last_seen_at (para tracking
--     simple de actividad — el catálogo lo bumpea cada visita).
--   • RLS: tabla email_verifications NO se expone al cliente — solo se
--     manipula desde Server Actions con service role.
-- =============================================================================

begin;

-- 1) Tabla email_verifications: storage de OTPs activos/pasados.
create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,                                 -- 4 dígitos
  expires_at timestamptz not null,                    -- TTL (10 min desde creación)
  attempts integer not null default 0,                -- rate limit (max 5)
  used_at timestamptz,                                -- null hasta que se verifica
  created_at timestamptz not null default now(),
  ip text,                                            -- para abuse detection (opt)
  user_agent text                                     -- idem (opt)
);

-- Index para query "último OTP activo del email X" (que NO esté usado y NO expirado).
create index if not exists email_verifications_email_active_idx
  on public.email_verifications (email, created_at desc)
  where used_at is null;

-- 2) users — columnas para auth gate web.
alter table public.users
  add column if not exists email_verified_at timestamptz;

alter table public.users
  add column if not exists last_seen_at timestamptz;

-- 3) RLS — email_verifications es server-only (service role bypass RLS).
alter table public.email_verifications enable row level security;

-- (Sin policies = nadie tiene acceso desde cliente, solo el service role.)

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='users'
--  and column_name in ('email_verified_at', 'last_seen_at');
--
-- select count(*) from public.email_verifications;  -- 0 esperado
--
-- select policyname from pg_policies where tablename='email_verifications';
-- (vacío esperado — solo service role accede)
-- =============================================================================

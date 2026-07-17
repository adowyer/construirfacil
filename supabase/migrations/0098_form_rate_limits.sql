-- 0098_form_rate_limits.sql
-- Buckets de rate-limit para forms públicos (submitLead: "Quiero esta casa" +
-- waitlist_provincia). bucket_key codifica IP+hora o email+día; la fila cuenta
-- cuántos submits se hicieron en esa ventana. Se consulta desde
-- `lib/anti-spam/rate-limit.ts` — fail-open ante error de DB (nunca bloqueamos
-- leads reales por un problema de infra).
--
-- Limpieza: opcional un cron VACUUM más adelante. Con TTL implícito (nadie
-- vuelve a leer una vez pasada la hora/día) el peso operacional es bajo.

create table if not exists public.form_rate_limits (
  bucket_key text primary key,
  count int not null default 0,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists form_rate_limits_updated_at_idx
  on public.form_rate_limits (updated_at);

comment on table public.form_rate_limits is
  'Rate-limit counters para submitLead (LeadForm público). bucket_key = ip:{ip}:h:{yyyymmddhh} o email:{email}:d:{yyyymmdd}. Fail-open ante errores de DB — ver lib/anti-spam/rate-limit.ts.';

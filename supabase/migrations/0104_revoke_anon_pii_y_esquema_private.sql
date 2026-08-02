-- 0104_revoke_anon_pii_y_esquema_private.sql
--
-- 🔴 URGENTE — DIVULGACIÓN DE DATOS PERSONALES SIN AUTENTICAR (hallazgo X-00, 2026-08-01)
--
-- QUÉ PASA HOY, EN VIVO
-- ---------------------
-- `public.users` (374 filas: id, email, name, phone, source, lead_status, …) es LEGIBLE con la
-- **anon key**, que es `NEXT_PUBLIC_SUPABASE_ANON_KEY` — o sea, la que viaja en el bundle de
-- JavaScript de construirfacil.com. Cualquiera que abra las devtools del sitio puede bajarse la
-- tabla entera de personas. Verificado con un GET a PostgREST usando sólo la anon key.
--
-- Es peor que el webhook de Ximia (X-01): ahí hacía falta CONOCER un mail para sacar un perfil;
-- acá no hace falta nada. Ley 25.326.
--
-- `public.leads` SÍ está protegida (`permission denied for table leads`) — alguien la cerró y no
-- cerró el resto. Estas otras están abiertas y hoy vacías, así que filtrarían en cuanto se usen:
-- conversations, messages, lead_qualification, property_matches, financial_matrix,
-- private_financing_commitments, form_rate_limits.
--
-- Son las tablas del lado Ximia que el KB de CF ya marcaba como pendientes desde el relevamiento
-- del 2026-05-31: «⚠️ Estas 12 NO tienen RLS ni triggers hoy — pendiente review de seguridad».
-- Esto paga esa deuda para las que contienen datos personales.
--
-- POR QUÉ ESTO NO ROMPE NADA
-- --------------------------
-- Todo el código de CF que toca estas tablas usa `createAdminClient` (service_role), que ignora
-- los grants: `app/auth/google-callback`, `app/auth/facebook-callback`, `app/(auth)/gate/actions`
-- (OTP) y `lib/anti-spam/rate-limit`. Ningún componente de navegador las consulta (verificado:
-- las queries client-side son de /admin y /portal y tocan marcas, attribute_*, house_models,
-- house_images, profiles). n8n entra por conexión Postgres directa con su propio rol, no por
-- PostgREST, así que tampoco se ve afectado.
--
-- NO se tocan en esta migración `house_catalog`, `marcas`, `projects`, `banks_financing`,
-- `construction_quotas` ni `lots_inventory`: son datos de negocio (no personales) y el catálogo
-- público podría estar leyéndolos por SSR con la anon key. Se revisan aparte, sin urgencia.
--
-- ⚠️ Esto revoca GRANTS, que es la capa de permisos de PostgREST. NO reemplaza a RLS: si mañana
-- se le vuelve a dar `select` a `anon` sobre alguna de estas tablas, queda abierta otra vez.
-- El candado de verdad (RLS con políticas) queda pendiente y anotado.

begin;

-- ── 1. Cerrar el acceso público a las tablas con datos personales ───────────────────────────
revoke all on table public.users                          from anon;
revoke all on table public.conversations                  from anon;
revoke all on table public.messages                       from anon;
revoke all on table public.lead_qualification             from anon;
revoke all on table public.property_matches               from anon;
revoke all on table public.financial_matrix               from anon;
revoke all on table public.private_financing_commitments  from anon;
revoke all on table public.form_rate_limits               from anon;

-- `authenticated` = cualquier usuario logueado de la app. Tampoco tiene por qué leer la tabla
-- de personas ni las tablas internas del agente.
revoke all on table public.users                          from authenticated;
revoke all on table public.conversations                  from authenticated;
revoke all on table public.messages                       from authenticated;
revoke all on table public.lead_qualification             from authenticated;
revoke all on table public.property_matches               from authenticated;
revoke all on table public.financial_matrix               from authenticated;
revoke all on table public.private_financing_commitments  from authenticated;
revoke all on table public.form_rate_limits               from authenticated;

-- `system_config` guarda parámetros (uva_value, usd_exchange_rate) y va a guardar un secreto
-- de firma. No lo lee nadie desde el navegador (0 usos en el código TS).
revoke all on table public.system_config                  from anon, authenticated;

-- ── 2. Esquema `private`: lo que PostgREST no puede ver aunque se equivoquen los grants ──────
-- PostgREST sólo expone los esquemas configurados (`public`). Un secreto en `private` es
-- inalcanzable por HTTP por construcción, no por permiso — que es la diferencia entre una
-- garantía y una configuración que alguien puede revertir sin darse cuenta.
-- n8n llega por conexión Postgres directa, así que lo lee sin problema.
create schema if not exists private;
revoke all on schema private from anon, authenticated, public;

create table if not exists private.app_secrets (
  key         text primary key,
  value       text not null,
  note        text,
  updated_at  timestamptz not null default now()
);
revoke all on table private.app_secrets from anon, authenticated, public;

comment on table private.app_secrets is
  'Secretos de aplicación legibles SOLO por conexión Postgres directa (n8n) o service_role. '
  'Nunca por PostgREST: el esquema private no está expuesto. '
  'Los VALORES no se cargan por migración (irían a git) — se insertan a mano. '
  'Hoy: ximia_identity_secret (X-01, verificación del token de identidad del widget).';

commit;

-- ── DESPUÉS DE CORRER ESTO ──────────────────────────────────────────────────────────────────
-- 1. Cargar el secreto (el VALOR no va acá, va a mano — está en CONSTRUIRFACIL/.env.local):
--
--      insert into private.app_secrets (key, value, note)
--      values ('ximia_identity_secret', '<pegar XIMIA_IDENTITY_SECRET>',
--              'HMAC del token de identidad del widget de Ximia — X-01')
--      on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- 2. Verificar que la fuga se cerró (debe dar 401 permission denied):
--      python3 scripts/test_anon_exposure.py

-- 0105_ingreso_en_pesos_con_rastro_usd.sql
--
-- X-02e (auditoría 2026-08-01) — EL INGRESO SE GUARDA EN PESOS, Y SE GUARDA CÓMO SE LLEGÓ A ESE NÚMERO
--
-- REGLA DE NEGOCIO (decidida por Andrea, 2026-08-01)
-- --------------------------------------------------
-- **El ingreso, para el banco, se considera en PESOS.** A diferencia del ahorro/anticipo, que sí
-- puede contarse en dólares para comprar la casa. Por eso las columnas de ingreso se llaman
-- `monthly_income_ars` / `partner_income_ars` desde siempre: el esquema ya afirmaba la regla.
--
-- QUÉ ESTABA MAL
-- --------------
-- El código no la cumplía, y de tres maneras a la vez:
--
--   1. `evaluate_financing` llama al motor con 9 argumentos → `p_income_currency` cae al default
--      'ARS'. `evaluate_casa_lote` y `recommend_house` sí le pasan la moneda que escribe el modelo.
--      Resultado: si el agente decide que el ingreso es en dólares, **recommend_house dimensiona el
--      presupuesto con el ingreso multiplicado por la cotización (~1.510×) y evaluate_financing lo
--      usa crudo — en la misma conversación.**
--   2. `leads` NO tenía ninguna columna de moneda para el ingreso, así que el número guardado lo lee
--      como pesos TODO lo que viene después: HubSpot, el mail de engagement, `qualify_leads`. Un
--      "gano 3.000 dólares" quedaba como un ingreso de tres mil pesos, para siempre y sin ruido.
--   3. Convertir sin dejar rastro es irreversible: con sólo el número en pesos, dentro de seis meses
--      nadie puede saber si eran pesos declarados o dólares convertidos, ni a qué cotización.
--
-- QUÉ HACE ESTA MIGRACIÓN
-- -----------------------
-- Guarda las DOS cosas, con la cotización que las une:
--   • `monthly_income_ars` / `partner_income_ars` → lo que mira el banco. Puede ser NULL (un lead
--     puede no haber declarado ingreso: hoy hay 50 así). Lo que NO puede es faltar si hay USD.
--   • `monthly_income_usd` / `partner_income_usd` → NULL salvo que la persona haya declarado en
--     dólares. Que sea NULL es información: significa "declaró en pesos".
--   • `income_fx_rate` + `income_fx_at` → la cotización usada y cuándo. Sin esto la terna no se puede
--     reconstruir ni auditar, y dos columnas con el mismo hecho y nada que las ate **derivan en
--     silencio** — que es la clase de bug que originó toda esta auditoría.
--
-- ⚠️ REGLA DE DERIVACIÓN (dura, decidida con la migración):
--    **Si `*_income_usd` NO es NULL, el `*_income_ars` correspondiente es DERIVADO** — nadie lo
--    edita a mano. Si una asesora corrige el ingreso en HubSpot, corrige PESOS y eso **borra** el
--    USD (ya no es una conversión: es un dato nuevo). Sin esta regla hay dos fuentes de verdad para
--    el mismo hecho, que es exactamente lo que estamos sacando del sistema.
--
-- NO se toca `savings_amount` + `savings_currency`: el ahorro SÍ puede ser dólares legítimamente
-- (hoy 3 leads). Su modelo (monto + flag) queda como ítem de higiene aparte, no se mezcla acá.
--
-- IMPACTO EN LOS 388 LEADS ACTUALES: cero. Las cuatro columnas nacen NULL y los tres CHECK se
-- cumplen solos. (Verificado antes de escribir: 50 leads con income NULL, 16 en 0, 332 sin partner.)

begin;

alter table public.leads
  add column if not exists monthly_income_usd numeric,
  add column if not exists partner_income_usd numeric,
  add column if not exists income_fx_rate     numeric,
  add column if not exists income_fx_at       timestamptz;

comment on column public.leads.monthly_income_ars is
  'Ingreso mensual del titular EN PESOS. Es lo que mira el banco y lo único que consumen el motor, '
  'HubSpot, el mail de engagement y qualify_leads. Si monthly_income_usd no es null, este valor es '
  'DERIVADO (usd * income_fx_rate) y no se edita a mano.';
comment on column public.leads.monthly_income_usd is
  'Sólo si la persona declaró el ingreso en dólares. NULL = declaró en pesos (eso es información, '
  'no un dato faltante).';
comment on column public.leads.income_fx_rate is
  'Cotización usada para convertir el/los ingreso(s) declarados en USD. Sin esto la terna '
  '(usd, ars, rate) no se puede reconstruir ni auditar.';

-- Si hay dólares, tiene que haber pesos: el banco no lee dólares.
alter table public.leads drop constraint if exists leads_income_usd_requires_ars;
alter table public.leads add  constraint leads_income_usd_requires_ars
  check (monthly_income_usd is null or monthly_income_ars is not null) not valid;
alter table public.leads validate constraint leads_income_usd_requires_ars;

alter table public.leads drop constraint if exists leads_partner_income_usd_requires_ars;
alter table public.leads add  constraint leads_partner_income_usd_requires_ars
  check (partner_income_usd is null or partner_income_ars is not null) not valid;
alter table public.leads validate constraint leads_partner_income_usd_requires_ars;

-- Si hay dólares, tiene que haber cotización: si no, la conversión es irreproducible.
alter table public.leads drop constraint if exists leads_income_usd_requires_fx;
alter table public.leads add  constraint leads_income_usd_requires_fx
  check ((monthly_income_usd is null and partner_income_usd is null) or income_fx_rate is not null)
  not valid;
alter table public.leads validate constraint leads_income_usd_requires_fx;

commit;

-- ── DESPUÉS DE CORRER ESTO ──────────────────────────────────────────────────────────────────
--   python3 scripts/test_income_currency.py      (en ~/Projects/XIMIA)
-- Afirma contra la base viva que: los tres CHECK existen, ningún lead viola la terna
-- (|ars - usd*rate| < 1), y que las tres tools de n8n le pasan SIEMPRE 'ARS' al motor.

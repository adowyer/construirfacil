-- =============================================================================
-- ConstruirFácil — Telemetría de promo_messages
-- Migration: 0056_promo_events.sql
-- =============================================================================
-- Tabla simple para medir performance de los banners admin-editables:
--   • event='impression' → cada vez que un banner se monta en pantalla del
--     usuario (lo dispara CatalogPromoBanner cuando entra al viewport / es
--     visible en el render, una vez por session).
--   • event='click'      → cuando el usuario clickea un CTA del banner.
--
-- Permite al founder responder "¿qué banner saco?" con datos en vez de
-- intuición. Auditor UX lo flagueó como bloqueante antes de tener 4+
-- banners activos en paralelo.
--
-- IDEMPOTENTE. Sin RLS por ahora (escritura desde server actions con
-- admin client). Si se expone a un cliente público, revisar RLS.
-- =============================================================================

begin;

create table if not exists public.promo_events (
  id           uuid primary key default gen_random_uuid(),
  promo_id     uuid not null references public.promo_messages(id) on delete cascade,
  event        text not null,
  provincia_id uuid          references public.provincias(id) on delete set null,
  tiene_lote   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='promo_events_event_check' and conrelid='public.promo_events'::regclass) then
    alter table public.promo_events
      add constraint promo_events_event_check check (event in ('impression','click'));
  end if;
  if not exists (select 1 from pg_constraint where conname='promo_events_tiene_lote_check' and conrelid='public.promo_events'::regclass) then
    alter table public.promo_events
      add constraint promo_events_tiene_lote_check check (tiene_lote is null or tiene_lote in ('si','no'));
  end if;
end $$;

comment on table public.promo_events is
  'Telemetría de banners promo_messages: impresiones y clicks. Permite reporting "qué banner convierte" sin discusión intuitiva.';
comment on column public.promo_events.tiene_lote is
  'Cohorte declarada por el usuario al momento del evento. Útil para A/B (¿el banner X funciona mejor en cohorte ''no''?).';

-- Índices para los 2 reportes más obvios:
--   1) Resumen por promo (CTR = clicks / impressions)
create index if not exists promo_events_promo_event_idx
  on public.promo_events (promo_id, event);
--   2) Eventos recientes (debugging + dashboard ts-based)
create index if not exists promo_events_created_at_idx
  on public.promo_events (created_at desc);

commit;

-- =============================================================================
-- REPORTING SAMPLE (post-migración, correr aparte)
-- =============================================================================
-- CTR por banner:
--   select
--     p.id, p.titulo, p.cuerpo,
--     count(*) filter (where e.event = 'impression') as imps,
--     count(*) filter (where e.event = 'click')      as clicks,
--     round(100.0 * count(*) filter (where e.event = 'click')::numeric
--           / nullif(count(*) filter (where e.event = 'impression'), 0), 2) as ctr_pct
--   from public.promo_messages p
--   left join public.promo_events e on e.promo_id = p.id
--   where p.activo = true
--   group by p.id, p.titulo, p.cuerpo
--   order by ctr_pct desc nulls last;
-- =============================================================================

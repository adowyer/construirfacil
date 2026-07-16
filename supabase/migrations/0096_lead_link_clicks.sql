-- 0096_lead_link_clicks.sql
-- Tracking de clics en los links de los mails: QUIÉN (lead) tocó QUÉ (casa/destino) y CUÁNDO.
--
-- Cadena: el mail lleva /api/track/click?u=<token-firmado-del-lead>&to=/modelos/<slug>
--         → la ruta valida la firma (HMAC dominio 'click'), INSERTA acá y redirige al destino.
-- Consumidores: scripts/reporte_engagement.py (columna "casas que miró") y, a futuro,
-- la ficha de HubSpot vía reconcile.
--
-- Nota: los 40 mails ya enviados (tandas 1 y 2, jul-2026) llevan links directos SIN tracking;
-- esto aplica de la tanda 3 / follow-ups en adelante.

create table if not exists public.lead_link_clicks (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  target     text not null,              -- path interno de destino, ej. /modelos/casa-ejes-cubo-copahue
  model_slug text,                       -- extraído del target cuando es una ficha de modelo
  channel    text not null default 'email',
  clicked_at timestamptz not null default now()
);

create index if not exists lead_link_clicks_lead_idx  on public.lead_link_clicks (lead_id, clicked_at desc);
create index if not exists lead_link_clicks_model_idx on public.lead_link_clicks (model_slug) where model_slug is not null;

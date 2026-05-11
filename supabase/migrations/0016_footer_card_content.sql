-- 0016_footer_card_content.sql
-- Cards editables del footer por marca. Cada marca puede tener N cards
-- (típicamente 4: Garantía / 100% Financiado / Fábrica / 50.000 m²).
-- El catálogo público lee de aquí cuando hay cards activas; sino fallback
-- a los TRUST_CARDS hardcoded en CatalogFooter.tsx.

create table if not exists public.footer_card_content (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas(id) on delete cascade,
  sort_order int not null default 100,

  -- Identificador del icono lucide-react (e.g. "ruler", "badge-check",
  -- "shield-check", "factory"). El renderer mapea estos strings a los
  -- componentes correspondientes con un fallback a "factory".
  icon_key text not null default 'factory',

  -- Texto destacado de la card (e.g. "50.000", "100%", "Garantía", "Fábrica").
  number_text text not null,
  -- Sufijo opcional al lado del número (e.g. "m²"). Puede ser null/'' para
  -- cards no numéricas (Garantía, Fábrica).
  unit_text text null,
  -- Texto chico debajo (e.g. "construidos por nuestro equipo").
  label_text text not null default '',

  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists footer_card_content_marca_idx
  on public.footer_card_content(marca_id, sort_order);

-- RLS: lectura pública para cards activas; escritura solo admin (vía service role).
alter table public.footer_card_content enable row level security;

drop policy if exists footer_card_content_public_read on public.footer_card_content;
create policy footer_card_content_public_read
  on public.footer_card_content
  for select
  using (status = 'active');

comment on table public.footer_card_content is
  'Cards editables del footer del catálogo, una fila por (marca, slot). El render usa estas cuando existen.';

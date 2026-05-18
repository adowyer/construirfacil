-- =============================================================================
-- ConstruirFácil — delivery_conditions_content
-- Migration: 0036_delivery_conditions_content.sql
-- =============================================================================
-- "Condiciones de Entrega": bloque editable (HTML enriquecido saneado) que se
-- muestra en una modal desde un pill sobre la galería de exterior de CADA
-- modelo. Mismo patrón que footer_content: default de CF (marca_id NULL) +
-- override por marca. Una fila por marca (y una global). RLS+grant incluidos
-- (lección 0030/0031: tabla nueva sin policy → la app lee 0 filas).
--
-- Idempotente: create table/index/policy if not exists; seed con WHERE NOT
-- EXISTS. Correr en bloques en el editor SQL de Supabase (tabla / índice /
-- rls+grant+policy / trigger / seed) — un script multi-statement revierte
-- todo si un statement falla.
-- =============================================================================

create table if not exists public.delivery_conditions_content (
  id         uuid primary key default gen_random_uuid(),
  marca_id   uuid references public.marcas(id) on delete cascade,
  body       text,
  status     text not null default 'active'
               check (status in ('active','inactive','archived')),
  updated_at timestamptz not null default now()
);

comment on table public.delivery_conditions_content is
  'Condiciones de Entrega (HTML saneado). marca_id NULL = default de CF; con valor = override de esa marca.';

-- Una sola fila por marca; una sola global (marca_id NULL).
create unique index if not exists delivery_conditions_marca_uniq
  on public.delivery_conditions_content (marca_id) nulls not distinct;

-- updated_at (función compartida ya creada en 0005).
drop trigger if exists delivery_conditions_content_updated_at
  on public.delivery_conditions_content;
create trigger delivery_conditions_content_updated_at
  before update on public.delivery_conditions_content
  for each row execute procedure public.handle_updated_at();

-- Lectura pública (writes = service-role, bypassa RLS).
grant select on table public.delivery_conditions_content to anon, authenticated;
alter table public.delivery_conditions_content enable row level security;
drop policy if exists "delivery_conditions_content public read"
  on public.delivery_conditions_content;
create policy "delivery_conditions_content public read"
  on public.delivery_conditions_content for select using (true);

-- Seed: fila global (CF) con el texto inicial. Idempotente.
insert into public.delivery_conditions_content (marca_id, body, status)
select null, $body$<p><strong>Casas pensadas para ser vividas, no para ser vendidas.</strong></p><p><strong>La casa perfecta.</strong> El sistema "Flex Build Suit" que gestiona nuestra Inteligencia Artificial permite que tu casa se adapte a tus posibilidades y necesidades. Podrás sumar dormitorios, baños, lavadero, quincho, balcones, terrazas o una galería para disfrutar el jardín.</p><p><strong>El asesoramiento perfecto.</strong> Un Agente de Inteligencia Artificial especialmente entrenado te guía en el proceso de elección, cotización y compra de tu casa. Elegís las características ideales, el diseño que te gusta, y el Agente gestiona tu operación de compra y financiación en tiempo real.</p><p><strong>La financiación perfecta.</strong> Un original programa financiero de precalificación y nuestro exclusivo sistema de preventa por "cupos" te permiten acceder al 100% de financiación con un mínimo anticipo. Elegís, postulas, pre aprobamos tu forma de pago, y gestionamos el crédito con la entidad seleccionada SIN COSTO EXTRA.</p><p><strong>El precio perfecto.</strong> No vendemos M2 ni proyectos cerrados. Diseñamos exactamente la casa que podés pagar, en el modelo que te gustó. No vas a encontrar en el mercado una casa mejor, en mejores condiciones.</p><p><strong>Llave en mano.</strong> Completado el "cupo" se inicia el proceso de construcción que en pocos meses te permitirá mudarte a tu nueva casa, y empezar a crecer con ella. Las unidades se entregan completamente terminadas y listas para mudarte.</p><p><strong>10 años de garantía escrita.</strong> Nuestra solución constructiva te asegura solidez, durabilidad, impermeabilidad, aislación termoacústica, eficiencia energética y habitabilidad, por muchos muchos años. Construimos casas para ser habitadas, no para ser vendidas.</p><p><strong>Materiales de primeras marcas.</strong> Trabajamos junto a marcas que te aseguran calidad y diseño, así no sólo tu casa se ve mejor, también evitarás pérdidas y filtraciones de agua que producen daños y molestos ruidos o fallas de uso. Tendrás calidad Aluar en las ventanas, Peirano en la grifería, Oblak en las puertas y Tarquini, The Flooring Company y Cerro Negro en los revestimientos, para mencionar sólo algunos ejemplos.</p><p><strong>Muebles de calidad superior.</strong> Las casas se entregan con muebles construidos a medida en nuestras plantas. Vanitory completo en cada baño, placares laminados en cada cuarto, y en la cocinas diseñamos muebles exclusivos con herrajes inoxidables, mesada de granito, puertas con freno de cierre, rieles suaves en los cajones, y una estética acorde al modelo de casa, que te va a encantar.</p><p><strong>Cerramientos con DVH y capas de aislación térmica e hídrica en los muros.</strong> Ahorrarás hasta un 50% de costos de calefacción y refrigeración y tu casa durará mucho más tiempo como nueva.</p><p><strong>Instalaciones eléctricas y pluviales previstas.</strong> Las casas vienen con luminarias estándar, para que puedas personalizar tu diseño a tu gusto, pero todas las instalaciones están listas en cada bocatoma, lo mismo que la instalación para acondicionadores de aire frío/calor y eventuales extensiones de baños, toilettes o lavadero.</p><p><strong>Todo lo no incluido, es posible.</strong> Nuestras casas llave en mano trae todo lo necesario, y lo que no está incluido se ofrece como accesorio, para tu comodidad. Podrás comprar a un precio imbatible los equipos de aire acondicionado, cocinas, heladeras, set de parrilla, pérgolas adicionales, equipos de energía solar, y mucho más. Oportunamente te proveeremos nuestro catálogo de accesorios.</p>$body$, 'active'
where not exists (
  select 1 from public.delivery_conditions_content where marca_id is null
);

-- =============================================================================
-- select marca_id, length(body), status from public.delivery_conditions_content;
-- =============================================================================

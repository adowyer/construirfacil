-- 0102_leads_source_file.sql
--
-- `source_file` sube de profile_json a columna real.
--
-- POR QUÉ: "¿en qué listado está fulano?" es una consulta semanal (regla "ubicar en el
-- listado": listado de origen + teléfono + si ya fue contactado). Hoy el dato vive dentro
-- de profile_json->>'source_file', que no se filtra ni se agrupa cómodo desde el SQL editor.
-- Como columna se consulta directo:  select name, phone, source_file from leads where ...
--
-- ALCANCE (sindicato_uocra, 318 fichas al 2026-07-30):
--   • 299 tienen el dato en profile_json  -> backfill directo (paso 2, abajo).
--   • 19 NO lo tienen: son las fichas del 11 y 12 de junio de 2026, el piloto, cargadas
--     ANTES de que el ingest OCR guardara la llave por ficha. Los listados registrados
--     arrancan en Listado3.pdf — no existe Listado1 ni Listado2 en la base — así que esos
--     19 son casi con seguridad esos dos listados. Se rellenan aparte, cruzando nombres
--     contra los PDFs originales. NO los inventamos: quedan NULL hasta confirmarlos.
--
-- La columna es DESNORMALIZADA a propósito: profile_json sigue siendo la fuente cruda del
-- OCR (no se toca). Esta columna es la copia consultable.
--
-- DDL: la corre Andrea a mano (Ximia/n8n no hace DDL).

alter table public.leads
  add column if not exists source_file text;

comment on column public.leads.source_file is
  'Listado PDF de origen de la ficha del sindicato (ej: Listado5.pdf, FichasChat-2026-07-16). '
  'Copia consultable de profile_json->>''source_file'', que sigue siendo la fuente cruda del OCR. '
  'NULL = origen no registrado (las 19 fichas del piloto, 11-12/06/2026) o lead que no viene de listado (web_form).';

-- Índice: el uso real es "traeme todos los de Listado5.pdf" y "cuántos hay por listado".
create index if not exists leads_source_file_idx
  on public.leads (source_file)
  where source_file is not null;

-- ---------------------------------------------------------------------------
-- PASO 2 — backfill de los 299 que ya tienen el dato en profile_json.
-- Idempotente: sólo pisa filas donde la columna todavía está vacía.
-- ---------------------------------------------------------------------------
update public.leads
   set source_file = profile_json->>'source_file'
 where source_file is null
   and coalesce(profile_json->>'source_file', '') <> '';

-- ---------------------------------------------------------------------------
-- PASO 3 — trigger de sincronización.
--
-- POR QUÉ: el ingest OCR vive en n8n y escribe profile_json, no esta columna. Sin trigger,
-- cada ficha nueva entra con source_file NULL y la columna se pudre en semanas — peor que
-- no tenerla. El trigger la mantiene sola, venga el lead de n8n, de un script o a mano.
-- (Regla de oro: la garantía en el código, no en el procedimiento de nadie.)
--
-- Sólo RELLENA, nunca pisa: si la columna ya tiene valor, se respeta. Eso protege las
-- correcciones manuales — en particular el recupero de las 19 fichas del piloto (0103),
-- cuyo profile_json está vacío y quedaría borrado por un trigger que sobreescribiera.
-- ---------------------------------------------------------------------------
create or replace function public.leads_sync_source_file()
returns trigger
language plpgsql
as $$
begin
  if new.source_file is null
     and coalesce(new.profile_json->>'source_file', '') <> '' then
    new.source_file := new.profile_json->>'source_file';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_sync_source_file on public.leads;
create trigger trg_leads_sync_source_file
  before insert or update of profile_json, source_file on public.leads
  for each row
  execute function public.leads_sync_source_file();

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN (correr después; esperado al 2026-07-30)
-- ---------------------------------------------------------------------------
-- select count(*) from public.leads where source_file is not null;   -- 299
--
-- select coalesce(source_file, '(sin listado)') as listado, count(*)
--   from public.leads where source = 'sindicato_uocra'
--  group by 1 order by 2 desc;                                       -- '(sin listado)' = 19
--
-- -- el trigger quedó puesto:
-- select tgname from pg_trigger where tgrelid = 'public.leads'::regclass
--   and tgname = 'trg_leads_sync_source_file';                        -- 1 fila
--
-- -- los 19 huérfanos, para cruzar contra Listado1/2.pdf:
-- select name, dni, phone, created_at::date
--   from public.leads
--  where source = 'sindicato_uocra' and source_file is null
--  order by created_at, name;

-- =============================================================================
-- 0084 — leads.transcript_json: transcript COMPLETO de la conversación (turn-by-turn).
--
-- Por qué: para las primeras conversaciones y el testeo de los contadores queremos ver QUÉ dijo Ximia
--   (texto completo, no solo los números). Hoy el texto vive solo en las ejecuciones de n8n, que se
--   purgan. Esto lo persiste durable, co-ubicado con el lead (mismo session_id), al lado del perfil y
--   los números financieros → fácil de leer junto.
--
-- Forma: un jsonb por lead = array de turnos [{role:'user'|'assistant', text, ts}]. El agente v2
--   APPENDEA el turno en cada upsert (concat jsonb), no pisa.
--
-- ⚠️ PROVISIONAL ("simple ahora"): a escala (muchas charlas largas) conviene una tabla de mensajes
--   dedicada + paginado; esto puede pesar. Para arrancar y analizar las primeras, alcanza y sobra.
-- =============================================================================
begin;

alter table public.leads add column if not exists transcript_json jsonb;

comment on column public.leads.transcript_json is
  'Transcript completo de la conversación: array jsonb de {role,text,ts}, appendeado por turno por el '
  'agente Ximia v2 (key por session_id). Provisional — a escala migrar a una tabla de mensajes dedicada.';

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (mirar antes de COMMIT)
-- -----------------------------------------------------------------------------
select 'col transcript_json' as chk, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema='public' and table_name='leads' and column_name='transcript_json';

commit;
-- rollback;

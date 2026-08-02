-- 0108_ximia_chat_memory.sql
--
-- X-09 (auditoría 2026-08-01) — LA MEMORIA DE LA CONVERSACIÓN DEJA DE VIVIR EN LA RAM DE UN WORKER
--
-- QUÉ PASA HOY
-- ------------
-- El nodo de memoria del agente es `memoryBufferWindow` (Simple Memory), que guarda el historial
-- **en memoria del proceso**. Dos problemas, los dos silenciosos:
--
--   1. La doc de n8n lo dice literal: *"Don't use this node if running n8n in queue mode"*, porque
--      *"n8n can't guarantee that every call to Simple Memory will go to the same worker"*.
--      **n8n Cloud corre en queue mode en los planes altos.**
--   2. En el código hay un desalojo por inactividad de 1 hora (`cleanupStaleBuffers()`): el lead se
--      va a comer, vuelve, y el historial no está. Sin error, sin registro, sin que nada falle.
--
-- Es la GOLDEN RULE otra vez: la garantía —que al lead se lo recuerde— tiene que vivir en la base
-- por la que pasan todos los caminos, no en la RAM de un worker que puede rotar.
--
-- POR QUÉ ESTA MIGRACIÓN EXISTE (y no dejamos que n8n cree la tabla)
-- ------------------------------------------------------------------
-- El nodo `memoryPostgresChat` **crea la tabla solo** si no existe. Eso es exactamente lo que el KB
-- del proyecto prohíbe: "Ximia/n8n NO hace DDL", y es cómo aparecieron las 12 tablas ad-hoc fuera
-- del repo que el relevamiento del 2026-05-31 todavía arrastra. Creándola acá, con la forma exacta,
-- el `CREATE TABLE IF NOT EXISTS` que el nodo emite en CADA llamada queda siendo un no-op.
--
-- ESQUEMA: verificado contra el código fuente de LangChain (no deducido)
-- ---------------------------------------------------------------------
-- `libs/langchain-community/src/stores/message/postgres.ts` (v0.3):
--     CREATE TABLE IF NOT EXISTS <t> (id SERIAL PRIMARY KEY,
--                                     session_id VARCHAR(255) NOT NULL,
--                                     message JSONB NOT NULL);
-- ⚠️ `VARCHAR(255)`, NO `text`: si la columna no coincide, el nodo no falla — usa la que hay, y el
-- problema aparece recién con un session_id largo.
--
-- EL ÍNDICE NO ES OPCIONAL
-- ------------------------
-- El store lee así, y **no tiene LIMIT**:
--     SELECT message FROM <t> WHERE session_id = $1 ORDER BY id
-- O sea: cada turno lee TODA la historia de esa sesión y recién después n8n recorta a la ventana de
-- contexto. Sin índice, cada turno de cada conversación es un scan completo de la tabla, que sólo
-- crece. Con índice es una lectura puntual.
--
-- 🔒 ES PII: acá adentro va la conversación COMPLETA
-- --------------------------------------------------
-- Lo que la persona escribió, palabra por palabra: ingresos, ahorros, situación familiar. Se revoca
-- `anon`/`authenticated` igual que en la `0104` — la lección de X-00 fue que nadie había preguntado
-- "¿quién puede leer esta tabla?" sobre las tablas nuevas. Ley 25.326.
--
-- ⚠️ PENDIENTE DE DECISIÓN (Andrea): RETENCIÓN. La tabla crece sin techo y guarda conversaciones
-- enteras. Ley 25.326 pide conservar sólo mientras sea necesario. Falta definir cada cuánto se
-- borran las sesiones viejas (y si el borrado corre por cron diario — NUNCA por minutos, ver la
-- regla dura de n8n en el KB de CF). No se decide en esta migración.

begin;

create table if not exists public.ximia_chat_memory (
  id         serial primary key,
  session_id varchar(255) not null,
  message    jsonb        not null
);

-- El store filtra por session_id y ordena por id, sin LIMIT: este índice es lo que evita que cada
-- turno escanee la tabla entera.
create index if not exists ximia_chat_memory_session_idx
  on public.ximia_chat_memory (session_id, id);

comment on table public.ximia_chat_memory is
  'Historial de chat del agente Ximia (nodo memoryPostgresChat de n8n). Esquema IMPUESTO por '
  'LangChain PostgresChatMessageHistory: no cambiar nombres ni tipos de columna — el nodo emite un '
  'CREATE TABLE IF NOT EXISTS en cada llamada y espera exactamente esta forma. '
  'CONTIENE PII (la conversación completa). Retención: PENDIENTE de definir.';

-- 🔒 Mismo cierre que la 0104: PostgREST expone por defecto todo lo que tenga grants a anon.
revoke all on public.ximia_chat_memory from anon, authenticated;
revoke all on sequence public.ximia_chat_memory_id_seq from anon, authenticated;

commit;

-- Después de correr: python3 scripts/test_chat_memory.py --live   (en ~/Projects/XIMIA)

-- cleanup_test_leads.sql
--
-- Limpieza ONE-OFF de datos de prueba en public.leads (no repetible).
-- Borra:
--   (1) TODOS los leads source='web_chat'  → son pruebas del lab del agente
--       Ximia (el agente todavía no está en el catálogo, solo en el lab).
--   (2) Los leads source='web_form' con email de dominios de test internos
--       (@andreadowyer.com, @construirfacil.com) → pruebas del botón
--       "quiero esta casa", no interesados reales.
--
-- NO toca leads reales: sindicato_uocra (77, en HubSpot, dni-keyed) ni los
-- web_form de interesados reales (gmail/hotmail/etc).
--
-- ⚠️ Andrea corre esto a mano en el SQL editor de Supabase, CON BACKUP previo.
-- Flujo sugerido: 1) backup, 2) correr PASO 1 (preview) y mirar los números,
-- 3) correr PASO 2 dentro de la transacción, verificar el conteo final ANTES
-- de COMMIT, 4) COMMIT (o ROLLBACK si algo no cuadra).

-- ════════════════════════════════════════════════════════════════════════
-- PASO 1 — PREVIEW (solo lectura, corré esto primero y revisá los conteos)
-- ════════════════════════════════════════════════════════════════════════

-- Cuántas filas matchea cada criterio de borrado:
select
  count(*) filter (where source = 'web_chat')                                   as web_chat_lab,
  count(*) filter (where source = 'web_form'
                   and (email ilike '%@andreadowyer.com'
                        or email ilike '%@construirfacil.com'))                 as web_form_test,
  count(*)                                                                       as total_a_borrar
from public.leads
where source = 'web_chat'
   or (source = 'web_form'
       and (email ilike '%@andreadowyer.com' or email ilike '%@construirfacil.com'));

-- Sanity check de lo que QUEDA como real (no debería tocarse):
select source, count(*) as quedan
from public.leads
where not (
      source = 'web_chat'
   or (source = 'web_form' and (email ilike '%@andreadowyer.com'
                                or email ilike '%@construirfacil.com'))
)
group by source
order by source;

-- ════════════════════════════════════════════════════════════════════════
-- PASO 2 — BORRADO (transaccional). Corré bloque por bloque; verificá el
--          conteo final; recién ahí COMMIT.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- (1) Lab del agente: todos los web_chat.
delete from public.leads
where source = 'web_chat';

-- (2) Tests del catálogo: web_form con dominios internos.
delete from public.leads
where source = 'web_form'
  and (email ilike '%@andreadowyer.com' or email ilike '%@construirfacil.com');

-- Verificación post-borrado (debe dar 0 en las dos columnas):
select
  count(*) filter (where source = 'web_chat')                                   as web_chat_restantes,
  count(*) filter (where source = 'web_form'
                   and (email ilike '%@andreadowyer.com'
                        or email ilike '%@construirfacil.com'))                 as web_form_test_restantes
from public.leads;

-- Si los dos dan 0 y el resto cuadra:
--   commit;
-- Si algo no cuadra:
--   rollback;

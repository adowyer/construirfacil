-- 0103_backfill_source_file_piloto.sql
--
-- Recupera el `source_file` de las 19 fichas del piloto (11-12/06/2026), las únicas que
-- quedaron sin origen registrado. Corre DESPUÉS de 0102 (que crea la columna).
--
-- CÓMO SE DETERMINÓ (2026-07-30, no es adivinanza):
--   • Los listados registrados en la base arrancan en Listado3.pdf — Listado1 y Listado2
--     no figuraban en ninguna ficha. Hueco en la numeración = candidatos.
--   • Se leyeron los dos PDFs del Drive (carpeta del sindicato, owner Guillermo).
--     Listado1.pdf creado 2026-06-11 18:06 · Listado2.pdf escaneado 2026-06-11 10:19 —
--     las mismas fechas de ingreso de las 19 fichas huérfanas.
--   • Listado1 contiene 12 fichas, Listado2 contiene 7. 12 + 7 = 19: cierra exacto, sin
--     sobrantes ni faltantes, y cada nombre aparece en UN solo PDF.
--   • 12 de los 19 machean además por DNI exacto. Los 7 restantes difieren en 1-2 dígitos
--     entre las dos pasadas de OCR (ver nota al pie) — la asignación al listado NO depende
--     del DNI, se sostiene por nombre + conteo.
--
-- Se listan por DNI (la llave estable en la base, no el nombre, que el OCR mutila:
-- "Andres Daniel Leguizamon" salió del PDF como "ANDRE'S DANIEL LEGU.ZAMÓN").
--
-- Idempotente: sólo escribe donde la columna está vacía.
--
-- DDL/DML de recupero: la corre Andrea a mano (Ximia/n8n no hace DDL).

-- Listado1.pdf — 12 fichas
update public.leads
   set source_file = 'Listado1.pdf'
 where source_file is null
   and source = 'sindicato_uocra'
   and dni in (
     '31466758',   -- Marisa Yanet Muñoz
     '33849998',   -- Vanesa Martinez
     '40100895',   -- Muñoz Perla Anahí
     '45171814',   -- Maximiliana Martinez
     '42848279',   -- Toledano Carla Ailín
     '44862559',   -- Fiorela Narvaez
     '34644149',   -- Silvana Gimenez
     '40217772',   -- Virginia Urquiza Cruz
     '39931365',   -- Muñoz Sosa Ayelen Elisabet
     '42749995',   -- Sosa Karen Denis
     '29719102',   -- Margarita Griselda Matto
     '30225723'    -- Andres Daniel Leguizamon  (confirmado a mano por Andrea)
   );

-- Listado2.pdf — 7 fichas
update public.leads
   set source_file = 'Listado2.pdf'
 where source_file is null
   and source = 'sindicato_uocra'
   and dni in (
     '36962824',   -- Verónica Evangelina Correa
     '41271243',   -- Ariel Agustin Muñoz
     '37086459',   -- Doris Bianco
     '39768207',   -- Daniela Tamara Bardaro
     '30568996',   -- Ana Maria Serrudo
     '38032526',   -- Carolina Ruth Choque
     '42105480'    -- Kevin Michel Fonseca
   );

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN
-- ---------------------------------------------------------------------------
-- select coalesce(source_file,'(sin listado)') as listado, count(*)
--   from public.leads where source='sindicato_uocra'
--  group by 1 order by 1;
--   -- esperado: Listado1.pdf = 12, Listado2.pdf = 7, '(sin listado)' = 0
--
-- select count(*) from public.leads
--  where source='sindicato_uocra' and source_file is null;   -- 0

-- ---------------------------------------------------------------------------
-- NOTA — el DNI de la base es el bueno. No lo toques con OCR.
-- ---------------------------------------------------------------------------
-- Al cruzar los PDFs, 7 de estas 19 fichas dieron un DNI distinto por 1-2 dígitos respecto
-- del que tiene la base. NO es un pendiente: la base gana, siempre.
--
--   Supabase ← HubSpot, y en HubSpot los datos pasaron por QA HUMANO.
--   Lo que está en HubSpot/Supabase es lo correcto.
--   Verificado 2026-07-30: las 19 fichas del piloto tienen synced_hubspot_id (19/19),
--   los 7 "dudosos" incluidos.
--
-- Una relectura por OCR (Drive, Vision, lo que sea) NO es evidencia contra el dato QA-eado:
-- es otra pasada de la misma máquina falible sobre el mismo manuscrito. Si alguna vez un
-- OCR discrepa con la base en un DNI, CUIL o nombre, el OCR está mal. Punto de partida, no
-- conclusión a revisar.

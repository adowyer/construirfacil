-- =============================================================================
-- 0101 — Legajo Nro.: identificador de solicitud, 6 caracteres (Letra + 5 dígitos).
--
-- ⚠️ DRAFT. NO correr sin el "dale" explícito de Andrea: emite ~300 legajos que,
--    por decisión, después NO se pueden cambiar.
--
-- -----------------------------------------------------------------------------
-- LA REGLA (D-009)
--   Letra según la situación de la persona AL MOMENTO DE ENTRAR:
--     A · tiene lote  Y  tiene anticipo
--     B · tiene lote, SIN anticipo
--     C · SIN lote, tiene anticipo
--     D · SIN lote y SIN anticipo
--   Número: correlativo GLOBAL de 5 dígitos, arranca en 50 → el primero es D00050.
--   (Arranca en 50 y no en 1 para que no se lea como un sistema recién nacido.)
--
-- CONGELADO — decisión de Andrea, 2026-07-21.
--   Una vez emitido, el legajo NO cambia nunca. Si en agosto la persona consigue
--   el lote, sigue siendo D00050. La letra dice CÓMO ENTRÓ, no cómo está hoy.
--   Razón: el legajo es una identidad — se anota en un cuaderno, se dice por
--   teléfono, se manda por mail. Un identificador que muta deja huérfano todo lo
--   que se escribió antes. La situación ACTUAL se lee de `has_lot`/`has_anticipo`,
--   que sí están siempre al día.
--   Esto no es un comentario: lo impone el trigger `trg_legajo_inmutable`.
--
-- ALCANCE — `sindicato_uocra` + `web_form`. Queda afuera `web_chat`: son pruebas
--   del laboratorio del agente, no personas. (Ver memoria: web_chat = lab.)
--
-- QUIÉN NO RECIBE LEGAJO (a propósito)
--   Quien no tenga `has_lot` o `has_anticipo` cargado. Sin esos dos datos no hay
--   letra, y la letra no se inventa: 21 leads del sindicato y los 46 de web_form
--   quedan sin legajo hasta que una asesora pregunte. Se emiten solos después,
--   volviendo a llamar a `emitir_legajos()`.
--
-- POR QUÉ `has_anticipo` NO SE DERIVA DE `savings_amount`
--   Se midió (2026-07-21). De los 300 leads con el booleano cargado, 8 no
--   coinciden con "monto > 0", y 7 de esos 8 dicen `has_anticipo = true` con el
--   monto VACÍO: la persona dijo que tiene anticipo pero no declaró cuánto.
--   Derivar `anticipo = monto > 0` los pasaría de A/C a B/D — les cambiaría la
--   letra por un dato que nunca dieron. Además, de los 74 sin booleano, 65
--   tampoco tienen monto: la derivación ni siquiera resolvía el problema que la
--   motivó. Queda descartada por evidencia. (GOLDEN RULE: si el dato no está,
--   se pregunta; no se completa con una suposición.)
--
-- EL NÚMERO SE CALCULA EN CÓDIGO, NUNCA A MANO
--   Toda emisión pasa por `emitir_legajos()`. Si alguien carga un legajo a mano
--   en una planilla o en HubSpot, se desincroniza — que es exactamente lo que
--   nos pasó con la tasa ADUS (ver D-001). El formato lo fuerza un CHECK y la
--   unicidad un índice: no hay forma de meter un legajo inventado sin que salte.
--
-- PROPIEDAD DEL CAMPO (D-008): el legajo lo emite SUPABASE. HubSpot lo LEE.
--   El sync de vuelta (`sync_hubspot_to_supabase.py`) NO debe listarlo nunca.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Columna, formato y unicidad.
-- -----------------------------------------------------------------------------
alter table public.leads
  add column if not exists legajo_nro text;

comment on column public.leads.legajo_nro is
  'Legajo de la solicitud: Letra (A/B/C/D según lote+anticipo AL INGRESAR) + 5 dígitos correlativos globales desde 00050. CONGELADO: no cambia aunque cambie la situación — la actual se lee de has_lot/has_anticipo. Se emite SOLO con emitir_legajos(); a mano nunca. Ver docs/DECISIONES.md D-009 y migración 0101.';

alter table public.leads
  drop constraint if exists leads_legajo_nro_formato;
alter table public.leads
  add constraint leads_legajo_nro_formato
  check (legajo_nro is null or legajo_nro ~ '^[A-D][0-9]{5}$');

create unique index if not exists leads_legajo_nro_uniq
  on public.leads (legajo_nro) where legajo_nro is not null;

-- -----------------------------------------------------------------------------
-- 2. La numeración. Una sola secuencia global (decisión de Andrea): el correlativo
--    no se reinicia por letra ni por tanda.
-- -----------------------------------------------------------------------------
create sequence if not exists public.legajo_seq start with 50 increment by 1 minvalue 50;

comment on sequence public.legajo_seq is
  'Correlativo global del Legajo Nro. Arranca en 50. No se reinicia nunca ni se separa por letra.';

-- -----------------------------------------------------------------------------
-- 3. EL CANDADO — el legajo es inmutable una vez emitido.
--    No alcanza con documentarlo: acá se rechaza el UPDATE.
-- -----------------------------------------------------------------------------
create or replace function public.guard_legajo_inmutable()
returns trigger
language plpgsql
as $$
begin
  if old.legajo_nro is not null and new.legajo_nro is distinct from old.legajo_nro then
    raise exception
      'El legajo % es inmutable (D-009): no se puede cambiar a % ni borrar. La letra dice cómo entró la persona, no cómo está hoy — la situación actual está en has_lot/has_anticipo.',
      old.legajo_nro, coalesce(new.legajo_nro, 'NULL');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_legajo_inmutable on public.leads;
create trigger trg_legajo_inmutable
  before update of legajo_nro on public.leads
  for each row execute function public.guard_legajo_inmutable();

-- -----------------------------------------------------------------------------
-- 4. La emisión. ÚNICO lugar donde se calcula la letra y se consume el número.
--    Es idempotente: solo toca leads sin legajo. Se puede correr cuantas veces
--    se quiera — cada vez emite los nuevos elegibles y nada más.
-- -----------------------------------------------------------------------------
create or replace function public.emitir_legajos()
returns table(lead_id uuid, nombre text, letra text, legajo text)
language plpgsql
as $$
declare r record; v_letra text; v_leg text;
begin
  for r in
    select l.id, l.name, l.apellido, l.has_lot, l.has_anticipo
      from public.leads l
     where l.legajo_nro is null
       and l.source in ('sindicato_uocra','web_form')   -- web_chat = lab, no son personas
       and l.has_lot is not null                        -- sin los dos datos no hay letra,
       and l.has_anticipo is not null                   -- y la letra no se inventa
     order by l.created_at, l.id                        -- orden estable → correlativo reproducible
  loop
    v_letra := case
                 when r.has_lot and r.has_anticipo then 'A'
                 when r.has_lot                    then 'B'
                 when r.has_anticipo               then 'C'
                 else                                   'D'
               end;
    v_leg := v_letra || lpad(nextval('public.legajo_seq')::text, 5, '0');

    update public.leads set legajo_nro = v_leg where id = r.id;

    lead_id := r.id;
    nombre  := nullif(trim(coalesce(r.name,'') || ' ' || coalesce(r.apellido,'')), '');
    letra   := v_letra;
    legajo  := v_leg;
    return next;
  end loop;
end;
$$;

comment on function public.emitir_legajos() is
  'Emite Legajo Nro. a los leads elegibles que aún no tienen. Idempotente. ÚNICO lugar donde se calcula la letra — no cargar legajos a mano. Ver D-009.';

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN — mirar ANTES de commitear.
-- -----------------------------------------------------------------------------
-- (a) Qué se va a emitir, por letra, antes de tocar nada.
select 'a) a emitir' as check,
       case when has_lot and has_anticipo then 'A' when has_lot then 'B'
            when has_anticipo then 'C' else 'D' end as letra,
       count(*)
  from public.leads
 where legajo_nro is null and source in ('sindicato_uocra','web_form')
   and has_lot is not null and has_anticipo is not null
 group by 1,2 order by 2;

-- (b) Quién queda AFUERA y por qué (son los que hay que preguntar en la llamada).
select 'b) sin legajo' as check, source,
       count(*) filter (where has_lot is null and has_anticipo is null) as faltan_ambos,
       count(*) filter (where has_lot is null and has_anticipo is not null) as falta_lote,
       count(*) filter (where has_lot is not null and has_anticipo is null) as falta_anticipo
  from public.leads
 where legajo_nro is null and source in ('sindicato_uocra','web_form')
   and (has_lot is null or has_anticipo is null)
 group by 1,2;

-- (c) LA EMISIÓN.
select letra, count(*) as emitidos, min(legajo) as desde, max(legajo) as hasta
  from public.emitir_legajos() group by letra order by letra;

-- (d) El primero debe ser 00050 y no puede haber repetidos ni formatos raros.
--     OJO: se ordena por el NÚMERO, no por el texto. `min(legajo_nro)` devolvería
--     el alfabéticamente menor (A00052), que no es el primero emitido (D00050).
--     Corregido después de correr la migración; el DDL no cambió.
select 'd) control' as check,
       (select legajo_nro from public.leads where legajo_nro is not null
         order by substring(legajo_nro from 2)::integer limit 1) as primero,
       (select legajo_nro from public.leads where legajo_nro is not null
         order by substring(legajo_nro from 2)::integer desc limit 1) as ultimo,
       count(*) as total, count(distinct legajo_nro) as distintos,
       count(*) filter (where legajo_nro !~ '^[A-D][0-9]{5}$') as formato_invalido
  from public.leads where legajo_nro is not null;

-- (e) La letra emitida coincide con la situación de HOY (debe dar 0 al emitir;
--     si con el tiempo aparecen filas acá NO es un error: es gente que cambió de
--     situación y su legajo quedó congelado, que es exactamente lo decidido).
select 'e) letra != situación actual' as check, count(*) as filas
  from public.leads
 where legajo_nro is not null
   and left(legajo_nro,1) <> case when has_lot and has_anticipo then 'A'
                                  when has_lot then 'B'
                                  when has_anticipo then 'C' else 'D' end;

commit;
-- rollback;

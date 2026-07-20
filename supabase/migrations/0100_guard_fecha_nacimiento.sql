-- =============================================================================
-- 0100 — Guard de `leads.fecha_nacimiento`: normaliza, NO rechaza.
--
-- PROBLEMA (2026-07-20): 9 leads con fecha de nacimiento imposible — años 2025 y
-- 2026, es decir en el futuro. Causa: la persona escribió la fecha del día en el
-- renglón de nacimiento de la ficha, y el sistema la copió sin cuestionarla.
-- Sobrevivieron la revisión manual porque son fechas válidas y bien formateadas:
-- no se ven como error, se ven como otro campo.
--
-- Uno de esos 9 está entre los 40 contactados por mail.
--
-- POR QUÉ UN TRIGGER Y NO UN CHECK
--   1. Un CHECK no puede usar `current_date` (no es inmutable) → habría que
--      hardcodear años, que se desactualizan solos.
--   2. Un CHECK RECHAZA la fila. Perderíamos el lead entero por una fecha mal
--      leída — el remedio peor que la enfermedad.
--   El trigger normaliza: deja el campo en null, guarda lo descartado y lo marca.
--   El lead entra igual, pero nadie calcula sobre un dato inventado.
--
-- POR QUÉ EN LA TABLA Y NO EN LA INGESTA
--   A `leads` le escriben la ingesta OCR (n8n), los scripts, y en algún momento
--   la vuelta de HubSpot (D-008). Un guard en la ingesta cubre un solo camino.
--   Acá no se puede esquivar. (GOLDEN RULE: la garantía va en código, y en el
--   punto por el que pasan todos.)
--
-- SOBRE EL AÑO DE 2 DÍGITOS (para quien arregle la ingesta)
--   El parser de formato está BIEN: verificado contra 286 fechas, las 286 se
--   leyeron dd/mm (argentino), 0 como mm/dd, y en 170 el primer número es >12,
--   lo que lo prueba de forma directa. El formato NO es el problema.
--   Lo que falta es resolver el siglo por el dato en vez de por una constante:
--   probar 19YY y 20YY y quedarse con el que dé una edad de persona en actividad.
--   Validado contra los 91 casos reales con año de 2 dígitos: 84 quedan igual,
--   0 cambian, 7 se marcan — exactamente los 7 malos, sin daño colateral.
--   Ojo: '26 NO es 1926 (serían 100 años). Cuando ningún siglo da una edad
--   plausible, la respuesta correcta es marcar, no elegir uno.  (Ver D-007.)
-- =============================================================================
begin;

create or replace function public.guard_fecha_nacimiento()
returns trigger
language plpgsql
as $$
declare
  v_edad integer;
  v_lcf  jsonb;
begin
  if new.fecha_nacimiento is null then
    return new;
  end if;

  v_edad := extract(year from age(current_date, new.fecha_nacimiento))::integer;

  -- Ventana de persona en actividad, holgada a propósito: el objetivo es cazar
  -- basura evidente (fechas futuras, recién nacidos, centenarios), NO calificar.
  -- La condición de negocio 18-65 del ADUS la evalúa el motor, no este trigger:
  -- un lead de 70 años es un dato VÁLIDO que simplemente no califica.
  if v_edad between 16 and 100 then
    return new;
  end if;

  -- Fecha imposible. No se pierde: queda registrada como descartada.
  v_lcf := coalesce(new.profile_json->'low_confidence_fields', '[]'::jsonb);
  if not (v_lcf ? 'fecha_nacimiento') then
    v_lcf := v_lcf || '["fecha_nacimiento"]'::jsonb;
  end if;

  new.profile_json := coalesce(new.profile_json,'{}'::jsonb)
    || jsonb_build_object(
         'low_confidence_fields', v_lcf,
         'fecha_nacimiento_descartada', jsonb_build_object(
            'valor',  new.fecha_nacimiento,
            'edad',   v_edad,
            'motivo', case when v_edad < 0  then 'fecha en el futuro'
                           when v_edad < 16 then 'edad menor a 16'
                           else 'edad mayor a 100' end,
            'cuando', current_date));

  new.fecha_nacimiento := null;
  return new;
end;
$$;

comment on function public.guard_fecha_nacimiento() is
  'Normaliza fechas de nacimiento imposibles: las deja en null, las archiva en profile_json.fecha_nacimiento_descartada y marca el campo en low_confidence_fields. NUNCA rechaza la fila (perder un lead por una fecha mal leída es peor). Ver migración 0100 y docs/DECISIONES.md D-007.';

drop trigger if exists trg_guard_fecha_nacimiento on public.leads;
create trigger trg_guard_fecha_nacimiento
  before insert or update of fecha_nacimiento on public.leads
  for each row execute function public.guard_fecha_nacimiento();

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN — mirar ANTES de commitear.
-- -----------------------------------------------------------------------------
-- (a) Las 7 filas que hoy tienen fecha futura. El trigger NO las toca sola:
--     solo actúa sobre INSERT/UPDATE. Este UPDATE no-op las hace pasar por él.
select 'a) antes' as check, count(*) as fechas_imposibles
  from public.leads
 where fecha_nacimiento is not null
   and extract(year from age(current_date, fecha_nacimiento))::integer not between 16 and 100;

update public.leads set fecha_nacimiento = fecha_nacimiento
 where fecha_nacimiento is not null
   and extract(year from age(current_date, fecha_nacimiento))::integer not between 16 and 100;

select 'b) después (debe dar 0)' as check, count(*) as fechas_imposibles
  from public.leads
 where fecha_nacimiento is not null
   and extract(year from age(current_date, fecha_nacimiento))::integer not between 16 and 100;

-- (c) Lo descartado quedó archivado, no perdido.
select 'c) archivadas' as check, name,
       profile_json->'fecha_nacimiento_descartada' as descartada
  from public.leads
 where profile_json ? 'fecha_nacimiento_descartada'
 order by name;

commit;
-- rollback;

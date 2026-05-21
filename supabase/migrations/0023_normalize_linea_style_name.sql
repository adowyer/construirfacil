-- =============================================================================
-- ConstruirFácil — Normalización de `linea` y `style_name`
-- Migration: 0023_normalize_linea_style_name.sql
-- =============================================================================
-- OBJETIVO: una sola forma canónica para los textos de agrupación del catálogo.
--   linea       -> 'LÍNEA ATLAS' / 'LÍNEA BOSQUE' / 'LÍNEA TERRA'
--   style_name  -> forma CON acento/apóstrofo (LANÍN, AMBA'Y, ALECRÍN,
--     CAMBOATÁ, GUAYUBIRÁ, TIMBÓ, INGÁ). Sin-acento real (ANCHICO, CEDRO,
--     LAPACHO, CALIFORNIA, ESCANDINAVIA, LANCASTER, PAMPA, PATAGONIA, DOMUYO,
--     MAHUIDA, TROMEN, COPAHUE) queda igual.
--
-- TABLAS: house_catalog.linea/.style_name, model_content.linea/.style_name,
--   line_content.linea, model_images.linea/.style_name, lineas.name.
-- NO TOCA: lineas.slug, *.linea_id, *.marca_id.
--
-- house_catalog.style_name HOY se guarda SIN acento: 02_import_models.mjs:343
--   escribe normalizeName(nombre), que strip-ea diacríticos y apóstrofos
--   (02_import_models.mjs:87-95). model_content los conserva (08_seed_content
--   desde el .docx; ver 0021 que keya 'AMBA''Y'/'LANÍN'). Por eso el join
--   editorial (catalog_panels / getModelContent) YA está roto para los 7
--   modelos con tilde. Esta migración sube house_catalog.style_name a la
--   forma acentuada para cerrar ese join. -> requiere los parches de
--   catalog_grouped.ts del runbook en el MISMO deploy (groupSlug/getGroupDetail
--   reconstruyen desde el slug y se rompen si cambia el valor crudo).
--
-- Trigger house_catalog_sync_denorm (def. 0003): se DISABLE al inicio y ENABLE
--   al final. DISABLE TRIGGER es transaccional -> un ROLLBACK lo restituye.
--   Tras la migración house_catalog.linea == lineas.name -> disparos futuros
--   (editar modelo en /admin manda linea_id) sincronizan al mismo string.
--
-- IDEMPOTENTE: cada CASE mapea {forma vieja | ya-canónica} -> canónica. El
--   colapso de duplicados conserva la fila más reciente (estable si no hay
--   duplicados). TRANSACCIÓN ÚNICA.
--
-- PRE-REQUISITO (verificar a mano antes de aplicar, ver runbook):
--   - confirmar el nombre real del trigger:
--       select tgname from pg_trigger
--        where tgrelid = 'public.house_catalog'::regclass and not tgisinternal;
--   - confirmar que `linea` solo contiene variantes de ATLAS/BOSQUE/TERRA
--     (bloque PRE al pie). Si aparece otra marca/línea, ampliar los CASE.
-- =============================================================================

begin;

-- (a) Deshabilitar trigger de sync (transaccional).
alter table public.house_catalog disable trigger house_catalog_sync_denorm;

-- (b) Colapsar duplicados legacy ANTES de renombrar (respeta los UNIQUE).

-- line_content: UNIQUE = (marca_id, linea, tipologia_code) NULLS NOT DISTINCT
-- (índice line_content_marca_linea_tipologia_uniq, mig 0020).
with norm as (
  select id,
    case
      when upper(btrim(linea)) in ('ATLAS','LINEA ATLAS','LÍNEA ATLAS')   then 'LÍNEA ATLAS'
      when upper(btrim(linea)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE') then 'LÍNEA BOSQUE'
      when upper(btrim(linea)) in ('TERRA','LINEA TERRA','LÍNEA TERRA')    then 'LÍNEA TERRA'
      else upper(btrim(linea))
    end as linea_canon,
    coalesce(marca_id::text, '<<null>>') as marca_key,
    coalesce(tipologia_code, '<<null>>') as tip_key,
    updated_at
  from public.line_content
),
ranked as (
  select id, row_number() over (
    partition by marca_key, linea_canon, tip_key
    order by updated_at desc nulls last, id desc
  ) as rn
  from norm
)
delete from public.line_content where id in (select id from ranked where rn > 1);

-- model_content: UNIQUE = (style_name, linea) (mig 0017). Clave canónica en
-- AMBAS columnas (legacy 'AMBAY','BOSQUE' y 'AMBA''Y','BOSQUE' colapsan).
with norm as (
  select id,
    case
      when upper(btrim(linea)) in ('ATLAS','LINEA ATLAS','LÍNEA ATLAS')   then 'LÍNEA ATLAS'
      when upper(btrim(linea)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE') then 'LÍNEA BOSQUE'
      when upper(btrim(linea)) in ('TERRA','LINEA TERRA','LÍNEA TERRA')    then 'LÍNEA TERRA'
      else upper(btrim(linea))
    end as linea_canon,
    case upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
      when 'ALECRIN' then 'ALECRÍN' when 'ALECRÍN' then 'ALECRÍN'
      when 'AMBAY' then 'AMBA''Y'   when 'AMBA''Y' then 'AMBA''Y'
      when 'CAMBOATA' then 'CAMBOATÁ' when 'CAMBOATÁ' then 'CAMBOATÁ'
      when 'GUAYUBIRA' then 'GUAYUBIRÁ' when 'GUAYUBIRÁ' then 'GUAYUBIRÁ'
      when 'INGA' then 'INGÁ'       when 'INGÁ' then 'INGÁ'
      when 'TIMBO' then 'TIMBÓ'     when 'TIMBÓ' then 'TIMBÓ'
      when 'LANIN' then 'LANÍN'     when 'LANÍN' then 'LANÍN'
      else upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
    end as style_canon,
    updated_at
  from public.model_content
),
ranked as (
  select id, row_number() over (
    partition by style_canon, linea_canon
    order by updated_at desc nulls last, id desc
  ) as rn
  from norm
)
delete from public.model_content where id in (select id from ranked where rn > 1);

-- (c) Normalizar `linea` en las tablas TEXT + lineas.name.
update public.house_catalog set linea =
  case
    when upper(btrim(linea)) in ('ATLAS','LINEA ATLAS','LÍNEA ATLAS')   then 'LÍNEA ATLAS'
    when upper(btrim(linea)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE') then 'LÍNEA BOSQUE'
    when upper(btrim(linea)) in ('TERRA','LINEA TERRA','LÍNEA TERRA')    then 'LÍNEA TERRA'
    else upper(btrim(linea))
  end
where linea is not null;

update public.model_content set linea =
  case
    when upper(btrim(linea)) in ('ATLAS','LINEA ATLAS','LÍNEA ATLAS')   then 'LÍNEA ATLAS'
    when upper(btrim(linea)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE') then 'LÍNEA BOSQUE'
    when upper(btrim(linea)) in ('TERRA','LINEA TERRA','LÍNEA TERRA')    then 'LÍNEA TERRA'
    else upper(btrim(linea))
  end
where linea is not null;

update public.line_content set linea =
  case
    when upper(btrim(linea)) in ('ATLAS','LINEA ATLAS','LÍNEA ATLAS')   then 'LÍNEA ATLAS'
    when upper(btrim(linea)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE') then 'LÍNEA BOSQUE'
    when upper(btrim(linea)) in ('TERRA','LINEA TERRA','LÍNEA TERRA')    then 'LÍNEA TERRA'
    else upper(btrim(linea))
  end
where linea is not null;

update public.model_images set linea =
  case
    when upper(btrim(linea)) in ('ATLAS','LINEA ATLAS','LÍNEA ATLAS')   then 'LÍNEA ATLAS'
    when upper(btrim(linea)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE') then 'LÍNEA BOSQUE'
    when upper(btrim(linea)) in ('TERRA','LINEA TERRA','LÍNEA TERRA')    then 'LÍNEA TERRA'
    else upper(btrim(linea))
  end
where linea is not null;

update public.lineas set name =
  case
    when upper(btrim(name)) in ('ATLAS','LINEA ATLAS','LÍNEA ATLAS')   then 'LÍNEA ATLAS'
    when upper(btrim(name)) in ('BOSQUE','LINEA BOSQUE','LÍNEA BOSQUE') then 'LÍNEA BOSQUE'
    when upper(btrim(name)) in ('TERRA','LINEA TERRA','LÍNEA TERRA')    then 'LÍNEA TERRA'
    else upper(btrim(name))
  end
where name is not null;

-- (d) Normalizar `style_name` sin-acento -> con-acento (mapa estático).
--     house_catalog incluida: 02_import_models.mjs la escribe SIN acento
--     (normalizeName strip-ea diacríticos) -> hay que subirla a la forma
--     acentuada para que cierre el join con model_content.
update public.model_images set style_name =
  case upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
    when 'ALECRIN' then 'ALECRÍN' when 'ALECRÍN' then 'ALECRÍN'
    when 'AMBAY' then 'AMBA''Y'   when 'AMBA''Y' then 'AMBA''Y'
    when 'CAMBOATA' then 'CAMBOATÁ' when 'CAMBOATÁ' then 'CAMBOATÁ'
    when 'GUAYUBIRA' then 'GUAYUBIRÁ' when 'GUAYUBIRÁ' then 'GUAYUBIRÁ'
    when 'INGA' then 'INGÁ'       when 'INGÁ' then 'INGÁ'
    when 'TIMBO' then 'TIMBÓ'     when 'TIMBÓ' then 'TIMBÓ'
    when 'LANIN' then 'LANÍN'     when 'LANÍN' then 'LANÍN'
    else upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
  end
where style_name is not null;

update public.house_catalog set style_name =
  case upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
    when 'ALECRIN' then 'ALECRÍN' when 'ALECRÍN' then 'ALECRÍN'
    when 'AMBAY' then 'AMBA''Y'   when 'AMBA''Y' then 'AMBA''Y'
    when 'CAMBOATA' then 'CAMBOATÁ' when 'CAMBOATÁ' then 'CAMBOATÁ'
    when 'GUAYUBIRA' then 'GUAYUBIRÁ' when 'GUAYUBIRÁ' then 'GUAYUBIRÁ'
    when 'INGA' then 'INGÁ'       when 'INGÁ' then 'INGÁ'
    when 'TIMBO' then 'TIMBÓ'     when 'TIMBÓ' then 'TIMBÓ'
    when 'LANIN' then 'LANÍN'     when 'LANÍN' then 'LANÍN'
    else upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
  end
where style_name is not null;

update public.model_content set style_name =
  case upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
    when 'ALECRIN' then 'ALECRÍN' when 'ALECRÍN' then 'ALECRÍN'
    when 'AMBAY' then 'AMBA''Y'   when 'AMBA''Y' then 'AMBA''Y'
    when 'CAMBOATA' then 'CAMBOATÁ' when 'CAMBOATÁ' then 'CAMBOATÁ'
    when 'GUAYUBIRA' then 'GUAYUBIRÁ' when 'GUAYUBIRÁ' then 'GUAYUBIRÁ'
    when 'INGA' then 'INGÁ'       when 'INGÁ' then 'INGÁ'
    when 'TIMBO' then 'TIMBÓ'     when 'TIMBÓ' then 'TIMBÓ'
    when 'LANIN' then 'LANÍN'     when 'LANÍN' then 'LANÍN'
    else upper(btrim(replace(replace(replace(style_name,'’',''''),'`',''''),'´','''')))
  end
where style_name is not null;

-- (e) Rehabilitar trigger.
alter table public.house_catalog enable trigger house_catalog_sync_denorm;

commit;

-- =============================================================================
-- VERIFICACIÓN — correr APARTE (NO dentro de la transacción de arriba).
-- ---- PRE (antes de aplicar) ----
-- select 'house_catalog' t, linea, count(*) from public.house_catalog group by linea
-- union all select 'model_content', linea, count(*) from public.model_content group by linea
-- union all select 'line_content',  linea, count(*) from public.line_content  group by linea
-- union all select 'model_images',  linea, count(*) from public.model_images  group by linea
-- union all select 'lineas',        name,  count(*) from public.lineas        group by name order by 1,2;
-- select 'house_catalog' t, style_name, count(*) from public.house_catalog group by style_name
-- union all select 'model_content', style_name, count(*) from public.model_content group by style_name
-- union all select 'model_images',  style_name, count(*) from public.model_images  group by style_name order by 1,2;
-- select tgname from pg_trigger
--   where tgrelid='public.house_catalog'::regclass and not tgisinternal;
-- ---- POST (después de aplicar) ----
-- (1) group by linea/name por tabla -> solo 'LÍNEA ATLAS/BOSQUE/TERRA' (+NULL).
-- (2) select slug,name from public.lineas order by sort_order;  -- slug intacto.
-- (3) line_content: 0 dups por (marca_id,linea,tipologia_code).
-- (3b) model_content: 0 dups por (style_name,linea).
-- (4) select distinct hc.linea from public.house_catalog hc
--       left join public.lineas l on l.id=hc.linea_id
--      where hc.linea is distinct from l.name and hc.linea_id is not null;  -- 0.
-- (5) ninguna de ALECRIN/AMBAY/CAMBOATA/GUAYUBIRA/INGA/TIMBO/LANIN sin acento.
-- (5b) house_catalog.style_name activos sin model_content (comparar vs PRE).
-- (6) select tgenabled from pg_trigger where tgname='house_catalog_sync_denorm'
--      and tgrelid='public.house_catalog'::regclass;  -- 'O', no 'D'.
-- =============================================================================

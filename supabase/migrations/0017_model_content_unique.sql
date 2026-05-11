-- 0017_model_content_unique.sql
-- Asegura UNIQUE(style_name, linea) en public.model_content.
--
-- La migración 0005 la declaró originalmente, pero en algunas DBs actuales
-- la constraint no está aplicada (posiblemente porque la importación masiva
-- ocurrió antes de aplicarla, dejando duplicados que impedían crearla).
--
-- Síntoma sin esta migración:
--   Al editar el contenido editorial de una casa desde /admin/models/[id]
--   se produce:
--     "there is no unique or exclusion constraint matching the
--      ON CONFLICT specification"
--   porque content-actions.ts hace upsert con onConflict: 'style_name,linea'.
--
-- Esta migración:
--   1) Detecta filas duplicadas por (style_name, linea) y conserva la más
--      reciente (mayor updated_at, desempate por id desc).
--   2) Agrega la UNIQUE constraint si todavía no existe.
-- Todo dentro de una transacción.

begin;

-- 1) Limpiar duplicados, conservando la fila más reciente.
with ranked as (
  select id,
         row_number() over (
           partition by style_name, linea
           order by updated_at desc, id desc
         ) as rn
  from public.model_content
)
delete from public.model_content
where id in (select id from ranked where rn > 1);

-- 2) Crear la UNIQUE constraint si no existe.
do $$
declare
  has_unique boolean;
begin
  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'model_content'
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(c.conkey) k
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = k
      ) = array['linea','style_name']::text[]
  ) into has_unique;

  if not has_unique then
    alter table public.model_content
      add constraint model_content_style_linea_unique unique (style_name, linea);
  end if;
end$$;

commit;

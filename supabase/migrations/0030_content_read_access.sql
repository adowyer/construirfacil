-- =============================================================================
-- ConstruirFácil — Lectura pública de header_slide_content / footer_content
-- Migration: 0030_content_read_access.sql
-- =============================================================================
-- BUG (confirmado por diagnóstico): header_slide_content, footer_content y
-- sistema_constructivo_content tienen RLS habilitada con 0 policies → la app
-- (anon/authenticated) lee 0 filas, aunque el GRANT exista y el SQL editor
-- (postgres) sí las vea. Resultado: admin con form vacío + público/SC en
-- fallback hardcoded. footer_card_content NO está afectada (tiene 1 policy).
--
-- sistema_constructivo_content: mismo bug latente desde 0019 — el contenido
-- de /admin/sistemas nunca se renderizó desde la DB (siempre fallback legacy).
--
-- Estas 3 son CONTENIDO DEL SITIO → lectura pública. Escrituras siguen solo
-- service-role (admin/portal usan createAdminClient, que BYPASSEA RLS — no
-- se agregan policies de insert/update/delete). `using (true)` (no
-- status='active') para que el admin pueda editar también filas inactivas.
--
-- Idempotente. Si el editor SQL de Supabase tira "rollback", correr por
-- bloques (grants / enable rls / cada policy).
-- =============================================================================

grant select on table public.header_slide_content          to anon, authenticated;
grant select on table public.footer_content                to anon, authenticated;
grant select on table public.sistema_constructivo_content  to anon, authenticated;

alter table public.header_slide_content         enable row level security;
alter table public.footer_content               enable row level security;
alter table public.sistema_constructivo_content enable row level security;

drop policy if exists "header_slide_content public read" on public.header_slide_content;
create policy "header_slide_content public read"
  on public.header_slide_content for select using (true);

drop policy if exists "footer_content public read" on public.footer_content;
create policy "footer_content public read"
  on public.footer_content for select using (true);

drop policy if exists "sistema_constructivo_content public read" on public.sistema_constructivo_content;
create policy "sistema_constructivo_content public read"
  on public.sistema_constructivo_content for select using (true);

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- select c.relname, c.relrowsecurity rls_on,
--        (select count(*) from pg_policies p where p.tablename=c.relname) policies
--   from pg_class c
--  where c.relname in
--    ('header_slide_content','footer_content','sistema_constructivo_content');
-- (esperado: rls_on=true, policies=1 en las 3)
-- =============================================================================

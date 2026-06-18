-- =============================================================================
-- 0082 — leads.status: permitir 'pending_consent' (lead sin consentimiento firmado).
--
-- ⚠️ DRAFT para revisar por Andrea. Correr en begin/commit.
--
-- Por qué: el ingest OCR marca como 'pending_consent' los forms sin "Sí, autorizo"
-- tildado (Ley 25.326 — no contactables hasta la firma). El check actual (0039) solo
-- permitía new/contacted/won/lost.
-- =============================================================================
begin;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('new','contacted','won','lost','pending_consent'));

select 'check actualizado' as chk, conname
from pg_constraint where conname = 'leads_status_check';

commit;
-- rollback;

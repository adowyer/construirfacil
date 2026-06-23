-- uocra_no_consent.sql
-- Listado de leads UOCRA SIN consentimiento (Ley 25.326) → para pedir el consent
-- específicamente antes de poder contactarlos comercialmente.
-- Andrea: corré y exportá a CSV. ⚠️ PII → queda en tu export local, NUNCA al repo.
-- (Hoy: 18 sin consent, 17 ya califican, todos con teléfono.)

select
  l.name                                            as nombre,
  l.dni,
  l.phone                                           as telefono,
  l.email,
  l.delegado,
  l.seccional,
  l.province                                        as provincia,
  case when l.qualifies then 'Sí' when l.qualifies = false then 'No' else '—' end as califica,
  l.bucket,
  l.loan_usd                                        as credito_usd
from public.leads l
where l.source = 'sindicato_uocra'
  and l.consent_captured_at is null
order by (l.qualifies is true) desc, l.loan_usd desc nulls last, l.name;

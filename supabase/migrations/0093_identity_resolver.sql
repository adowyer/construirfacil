-- 0093_identity_resolver.sql
--
-- Identidad canónica: UNA fila en public.users por persona real, compartida por
-- el catálogo (login email), el OCR UOCRA (DNI/CUIL) y Ximia (chat).
-- Hoy users sólo se llena por email desde el catálogo; leads.user_id y
-- conversations.user_id NUNCA se setean (universos separados). Esto lo une.
--
-- Llave de identidad: progresiva. El email es la llave práctica siempre-presente
-- (login). El DNI/CUIL es la llave FUERTE, llega más tarde (al iniciar el cálculo
-- financiero). resolve_user() reconcilia: DNI/CUIL → email → teléfono → crea, y
-- COLAPSA dos filas si un identificador nuevo las cruza (ej. lead UOCRA por DNI
-- que después se loguea por email).
--
-- DDL: la corre Andrea a mano (Ximia/n8n no hace DDL).

-- 1. Identificadores fuertes en users (faltaban).
alter table public.users
  add column if not exists dni          text,
  add column if not exists cuil         text,
  add column if not exists last_seen_at timestamptz;

-- Una sola fila por DNI / CUIL (parcial: sólo cuando hay dato).
create unique index if not exists users_dni_uidx  on public.users (dni)  where dni  is not null;
create unique index if not exists users_cuil_uidx on public.users (cuil) where cuil is not null;

comment on column public.users.dni  is 'DNI (llave fuerte de identidad). Se engancha al iniciar el cálculo financiero.';
comment on column public.users.cuil is 'CUIL (llave fuerte de identidad).';


-- 2. resolve_user(): upsert de la identidad canónica. Devuelve el user_id.
--    Match en orden de fuerza (DNI → CUIL → email → teléfono); si no, crea.
--    Enriquece la fila (llena lo que falta, no pisa). Si un identificador
--    apunta a OTRA fila, la COLAPSA (repunta leads/conversations, funde campos).
create or replace function public.resolve_user(
  p_email  text default null,
  p_phone  text default null,
  p_dni    text default null,
  p_cuil   text default null,
  p_name   text default null,
  p_source text default null
) returns uuid
language plpgsql
as $$
declare
  v_id    uuid;
  v_other uuid;
  v_o     public.users;   -- snapshot de la fila a fundir
begin
  -- normalizar (vacío → null)
  p_email := nullif(lower(trim(p_email)), '');
  p_phone := nullif(trim(p_phone), '');
  p_dni   := nullif(trim(p_dni), '');
  p_cuil  := nullif(trim(p_cuil), '');
  p_name  := nullif(trim(p_name), '');

  -- Llaves de IDENTIDAD: DNI, CUIL, email. El teléfono NO (las familias lo
  -- comparten → fundiría a dos personas distintas). Se guarda como dato.
  if p_email is null and p_dni is null and p_cuil is null then
    return null;  -- nada con qué identificar
  end if;

  -- match en orden de fuerza
  if p_dni is not null then
    select id into v_id from public.users where dni = p_dni limit 1;
  end if;
  if v_id is null and p_cuil is not null then
    select id into v_id from public.users where cuil = p_cuil limit 1;
  end if;
  if v_id is null and p_email is not null then
    select id into v_id from public.users where lower(email) = p_email limit 1;
  end if;

  -- no hay nadie → crear
  if v_id is null then
    insert into public.users (email, phone, dni, cuil, name, source, last_seen_at, created_at, updated_at)
    values (p_email, p_phone, p_dni, p_cuil, p_name, coalesce(p_source, 'resolve'), now(), now(), now())
    returning id into v_id;
    return v_id;
  end if;

  -- COLAPSO: si algún identificador provisto apunta a OTRA fila, fundirla en v_id.
  -- (Caso típico: matcheó por DNI [lead UOCRA] pero el email ya creó otro user.)
  for v_other in
    select id from public.users
    where id <> v_id
      and ( (p_email is not null and lower(email) = p_email)
         or (p_dni   is not null and dni  = p_dni)
         or (p_cuil  is not null and cuil = p_cuil) )
  loop
    select * into v_o from public.users where id = v_other;
    -- repuntar referencias a la fila canónica
    update public.leads         set user_id = v_id where user_id = v_other;
    update public.conversations set user_id = v_id where user_id = v_other;
    -- borrar la duplicada ANTES de fundir sus campos (índices únicos)
    delete from public.users where id = v_other;
    -- fundir lo que la canónica no tenga
    update public.users set
      email = coalesce(email, v_o.email),
      phone = coalesce(phone, v_o.phone),
      dni   = coalesce(dni,   v_o.dni),
      cuil  = coalesce(cuil,  v_o.cuil),
      name  = coalesce(name,  v_o.name)
    where id = v_id;
  end loop;

  -- enriquecer la fila canónica con lo que vino y falte (no pisa lo existente)
  update public.users set
    email        = coalesce(email, p_email),
    phone        = coalesce(phone, p_phone),
    dni          = coalesce(dni,   p_dni),
    cuil         = coalesce(cuil,  p_cuil),
    name         = coalesce(name,  p_name),
    last_seen_at = now(),
    updated_at   = now()
  where id = v_id;

  return v_id;
end;
$$;

comment on function public.resolve_user is
  'Identidad canónica: upsert de public.users por DNI/CUIL→email→teléfono, con colapso de duplicados (repunta leads/conversations). Lo llaman catálogo, OCR y Ximia.';

-- 0112 · UN SOLO CÓDIGO OTP VIVO POR MAIL, garantizado por la base
--
-- POR QUÉ
-- -------
-- `requestOTP` limita por email con un SELECT seguido de un INSERT, sin atomicidad: tres requests
-- concurrentes leen «no hay código activo» y las tres insertan. Y `verifyOTP` compara contra UNA
-- sola fila —la más nueva—, así que si la persona abre el mail del PRIMER código, el que tipea no
-- coincide nunca y NO PUEDE ENTRAR. La puerta rechaza a quien tiene la llave correcta.
--
-- No es teórico. Al 2026-08-06 hay 5 mails con más de un código sin usar, y el caso de
-- `ricardoulisesgonzalez15@gmail.com` (17-jul) es el patrón completo: tres códigos en dos minutos,
-- dos intentos fallidos, se fue, y volvió 3 h 20 min después a entrar con uno nuevo.
--
-- LA DECISIÓN (Andrea, 2026-08-06)
-- --------------------------------
-- Descartada la idea de «aceptar cualquier código activo»: normalizaba tener varios vivos, y de
-- paso rompía el freno de fuerza bruta (un código errado no matchea ninguna fila -> no hay dónde
-- contar intentos -> 4 dígitos sin tope).
-- Se garantiza lo contrario: **que nunca haya más de uno**. Con eso `verifyOTP` no se toca —sigue
-- tomando el activo, porque sólo puede haber uno, y es el que la persona recibió.
--
-- GOLDEN RULE: la garantía va en la base, por donde pasan TODOS los caminos, y no en el código de
-- una sola aplicación. Es la misma lección de los duplicados de `leads`.
--
-- ⚠️ NO se toca el vencimiento. Sigue en 10 minutos (`OTP_TTL_MIN`), que es lo razonable para un
-- código que viaja por MAIL: la latencia de entrega no la controlamos, y apretarlo a un minuto
-- fabricaría el mismo portazo que esta migración cierra.

begin;

-- 1) LIMPIEZA PREVIA. El índice no se puede crear con duplicados vivos: hay 5 mails con más de una
--    fila sin usar (10 filas de más). Se invalidan las VIEJAS y se conserva la más reciente de cada
--    mail, que es la que hoy `verifyOTP` considera de todos modos — así nadie que tenga un código
--    en la mano ahora mismo queda peor de lo que ya estaba.
with ranked as (
  select id,
         row_number() over (partition by email order by created_at desc) as rn
    from public.email_verifications
   where used_at is null
)
update public.email_verifications v
   set used_at = now()
  from ranked r
 where v.id = r.id
   and r.rn > 1;

-- 2) LA GARANTÍA. Un solo código sin usar por mail.
--    ⚠️ El predicado es `used_at is null` y NO incluye `expires_at > now()`: un `now()` no es
--    inmutable y Postgres no lo acepta en un índice parcial. Consecuencia: una fila VENCIDA y sin
--    usar también ocupa el lugar — por eso `requestOTP` tiene que invalidar lo anterior ANTES de
--    insertar (si no, la persona no podría pedir un código nuevo nunca más). El código de la app
--    lo hace; este comentario existe para que nadie saque esa invalidación creyendo que sobra.
create unique index if not exists uq_email_verifications_activo
  on public.email_verifications (email)
  where used_at is null;

commit;

-- VERIFICACIÓN (correr después, debe dar 0 filas):
--   select email, count(*) from public.email_verifications
--    where used_at is null group by email having count(*) > 1;

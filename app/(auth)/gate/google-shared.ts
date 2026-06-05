/**
 * app/(auth)/gate/google-shared.ts
 *
 * Constants shared entre el server action de inicio del flow y el route
 * handler del callback. No tiene `'use server'` para poder exportar valores
 * no-función (Next 16 restringe los archivos 'use server' a async fns).
 */

export const GOOGLE_OAUTH_STATE_COOKIE = 'cf_oauth_state'

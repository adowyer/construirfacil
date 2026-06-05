/**
 * app/(auth)/gate/facebook-shared.ts
 *
 * Constants shared entre el server action de inicio del flow y el route
 * handler del callback. Sin `'use server'` porque exporta strings.
 */

export const FACEBOOK_OAUTH_STATE_COOKIE = 'cf_fb_oauth_state'

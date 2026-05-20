/**
 * lib/supabase/queries/bank_financing.ts
 *
 * Productos de financiación de los bancos. Tabla de Ximia, MISMO proyecto
 * Supabase que el catálogo. La tabla se llama `banks_financing` (con "s").
 * Es data interna → se lee server-side con service-role (createAdminClient).
 * El catálogo la usa sólo para derivar la cuota "desde" (mismo dato que la
 * precalificación de Ximia → nunca se contradicen). Resiliente: error → [].
 *
 * Esquema según el export real (Banks Financing Data.csv).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface BankProduct {
  id: string
  bank_name: string
  product_name: string
  loan_type: string | null
  destination: string | null
  max_financing_pct: number
  max_term_months: number
  interest_rate: number // % anual (UVA real)
  interest_adjustment: string | null // 'UVA'
  currency: string | null // 'ARS'
  max_loan_amount_ars: number | null
  is_active: boolean
}

export async function getActiveBankProducts(
  client: SupabaseClient,
): Promise<BankProduct[]> {
  const { data, error } = await client
    .from('banks_financing')
    .select(
      'id, bank_name, product_name, loan_type, destination, max_financing_pct, max_term_months, interest_rate, interest_adjustment, currency, max_loan_amount_ars, is_active',
    )
    .eq('is_active', true)
  if (error) {
    console.error('[getActiveBankProducts]', error.message)
    return []
  }
  return (data ?? []) as BankProduct[]
}

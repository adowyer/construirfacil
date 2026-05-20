/**
 * lib/pricing/cuota.ts
 *
 * Motor de cuota — funciones PURAS (sin Supabase, testeables). Deriva la
 * cuota mensual inicial desde el precio de lista (USD), un T.C. de
 * referencia y un producto bancario.
 *
 * Nota UVA: `interest_rate` ya es la tasa real UVA del producto. La cuota
 * resultante es la CUOTA INICIAL en UVA; el ajuste por inflación NO se
 * calcula acá (se comunica en el caveat). Nunca devuelve un número si falta
 * un input real (degrada a null → la UI no muestra cuota).
 */

/** Cuota de un crédito francés. monthlyRate en fracción (0.03/12). */
export function frenchMonthlyPayment(
  principal: number,
  monthlyRate: number,
  nMonths: number,
): number {
  if (principal <= 0 || nMonths <= 0) return 0
  if (monthlyRate <= 0) return principal / nMonths
  const f = Math.pow(1 + monthlyRate, nMonths)
  return (principal * (monthlyRate * f)) / (f - 1)
}

/** Precio con el delta del tramo aplicado (+caro / -barato). */
export function applyTierModifier(priceUsd: number, pct: number): number {
  return priceUsd * (1 + pct / 100)
}

export interface CuotaProduct {
  monthlyRate: number
  nMonths: number
  capArs: number | null
}

/** Mejor cuota POR PRECIO entre N productos: prefiere los que cubren el
 *  principal completo (cap >= principal) y de ésos el de cuota más baja;
 *  si ninguno cubre, cae al producto que minimice la cuota CAPADA y
 *  reporta el adelanto necesario. Esto permite que el tramo Uber se
 *  diferencie: distintos precios pueden encontrar distintos productos
 *  óptimos. null si falta input real (no se inventa cuota). */
export function pickBestCuotaArs(args: {
  priceUsd: number | null | undefined
  fxRef: number | null | undefined
  products: CuotaProduct[]
}): { cuotaArs: number; downPaymentArs: number } | null {
  const { priceUsd, fxRef, products } = args
  if (!priceUsd || priceUsd <= 0 || !fxRef || fxRef <= 0) return null
  if (products.length === 0) return null
  const principalRequested = priceUsd * fxRef

  type Score = { cuotaArs: number; downPaymentArs: number }
  let best: Score | null = null

  // 1) Productos que cubren el principal completo → adelanto = 0.
  for (const p of products) {
    const cap = p.capArs ?? Infinity
    if (cap < principalRequested) continue
    const cuotaArs = Math.round(
      frenchMonthlyPayment(principalRequested, p.monthlyRate, p.nMonths),
    )
    if (!best || cuotaArs < best.cuotaArs) {
      best = { cuotaArs, downPaymentArs: 0 }
    }
  }
  if (best) return best

  // 2) Ninguno cubre: aceptar adelanto. Elegir el que minimice la cuota
  //    (con principal capado al máximo de cada producto).
  for (const p of products) {
    const cap = p.capArs ?? Infinity
    const principal = Math.min(principalRequested, cap)
    const cuotaArs = Math.round(
      frenchMonthlyPayment(principal, p.monthlyRate, p.nMonths),
    )
    const downPaymentArs = Math.max(0, principalRequested - cap)
    if (!best || cuotaArs < best.cuotaArs) {
      best = { cuotaArs, downPaymentArs }
    }
  }
  return best
}


import type { Element } from './network'

export type ESeries = 'E12' | 'E24'

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]
const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]

export const SERIES: Record<ESeries, number[]> = { E12, E24 }

/** Nearest preferred value (by ratio) in the given series, across any decade. */
export function nearestE(value: number, series: ESeries): number {
  if (!(value > 0) || !Number.isFinite(value)) return value
  const base = SERIES[series]
  const dec = Math.floor(Math.log10(value))
  const mant = value / Math.pow(10, dec)
  let best = base[0]
  let bestErr = Infinity
  for (const m of [...base, 10]) {
    const err = Math.abs(Math.log(m / mant))
    if (err < bestErr) {
      bestErr = err
      best = m
    }
  }
  // Round to 3 significant digits to drop floating-point dust from the decade scaling.
  return Number((best * Math.pow(10, dec)).toPrecision(3))
}

/** Relative error of a rounded value, in percent. */
export const errorPct = (ideal: number, actual: number): number => ((actual - ideal) / ideal) * 100

/** Replace lumped L/C/R values with the nearest preferred values; lines and stubs are left alone. */
export function roundElements(els: Element[], series: ESeries): Element[] {
  return els.map((e) => (e.type === 'L' || e.type === 'C' || e.type === 'R' ? { ...e, value: nearestE(e.value, series) } : e))
}

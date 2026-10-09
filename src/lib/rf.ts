import { abs, arg, c, div, polar, add, sub, type C } from './complex'

export const SPEED_OF_LIGHT = 299792458
const BIG = 1e12

/** Reflection coefficient of impedance z against reference z0. Open circuit gives +1. */
export function zToGamma(z: C, z0: number): C {
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im) || abs(z) > BIG) return c(1, 0)
  return div(sub(z, c(z0)), add(z, c(z0)))
}

/** Impedance for reflection coefficient g. |Γ| is capped just under 1 to stay finite. */
export function gammaToZ(g: C, z0: number): C {
  const m = abs(g)
  const gg = m > 0.999999 ? polar(0.999999, arg(g)) : g
  const z = div(add(c(1), gg), sub(c(1), gg))
  return { re: z.re * z0, im: z.im * z0 }
}

export function vswrFromGamma(g: C | number): number {
  const m = typeof g === 'number' ? g : abs(g)
  return m >= 1 ? Infinity : (1 + m) / (1 - m)
}

export function returnLossDb(g: C | number): number {
  const m = typeof g === 'number' ? g : abs(g)
  return m <= 0 ? Infinity : -20 * Math.log10(m)
}

export function gammaMagFromReturnLoss(rl: number): number {
  return Math.pow(10, -Math.max(rl, 0) / 20)
}

export function gammaMagFromVswr(s: number): number {
  return (Math.max(s, 1) - 1) / (Math.max(s, 1) + 1)
}

/** Mismatch loss in dB: power lost to reflection. */
export function mismatchLossDb(g: C | number): number {
  const m = typeof g === 'number' ? g : abs(g)
  return -10 * Math.log10(Math.max(1 - m * m, 1e-12))
}

export const deg2rad = (d: number) => (d * Math.PI) / 180
export const rad2deg = (r: number) => (r * 180) / Math.PI

/** |S11| in dB, floored at -80 dB so plots stay readable. */
export function s11Db(g: C | number): number {
  const m = typeof g === 'number' ? g : abs(g)
  return Math.max(20 * Math.log10(Math.max(m, 1e-12)), -80)
}

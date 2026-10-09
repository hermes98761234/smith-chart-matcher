import { abs, add, c, div, inv, mul, scale, type C } from './complex'
import { deg2rad, vswrFromGamma, zToGamma } from './rf'

/**
 * Elements are listed from the load towards the source.
 *  - L, C, R: lumped, series or shunt (value in H, F, ohm).
 *  - line: series transmission line of characteristic impedance z0, `deg` electrical degrees at the design frequency.
 *  - stub: open or short stub of impedance z0 and `deg` degrees, in series or in shunt.
 */
export type Element =
  | { type: 'L' | 'C' | 'R'; mount: 'series' | 'shunt'; value: number }
  | { type: 'line'; z0: number; deg: number }
  | { type: 'stub'; mount: 'series' | 'shunt'; open: boolean; z0: number; deg: number }

export type Lumped = Extract<Element, { type: 'L' | 'C' | 'R' }>
export const isLumped = (e: Element): e is Lumped => e.type === 'L' || e.type === 'C' || e.type === 'R'

const TINY = 1e-12

/** Immittance an element adds at frequency f (design frequency f0): impedance if series, admittance if shunt. */
export function elementImmittance(el: Exclude<Element, { type: 'line' }>, f: number, f0: number): C {
  const w = 2 * Math.PI * f
  if (el.type === 'stub') {
    const th = deg2rad(el.deg) * (f / f0)
    const s = Math.sin(th)
    const co = Math.cos(th)
    const sd = Math.abs(s) < TINY ? (s < 0 ? -TINY : TINY) : s
    const cd = Math.abs(co) < TINY ? (co < 0 ? -TINY : TINY) : co
    if (el.mount === 'shunt') {
      // Y = jY0 tan(θ) open, -jY0 cot(θ) short
      return el.open ? c(0, s / cd / el.z0) : c(0, -co / sd / el.z0)
    }
    // Z = -jZ0 cot(θ) open, jZ0 tan(θ) short
    return el.open ? c(0, (-co / sd) * el.z0) : c(0, (s / cd) * el.z0)
  }
  if (el.mount === 'series') {
    if (el.type === 'R') return c(el.value)
    if (el.type === 'L') return c(0, w * el.value)
    return c(0, -1 / Math.max(w * el.value, TINY))
  }
  if (el.type === 'R') return c(1 / Math.max(el.value, TINY))
  if (el.type === 'C') return c(0, w * el.value)
  return c(0, -1 / Math.max(w * el.value, TINY))
}

/** Impedance seen looking into a line of impedance zc and electrical angle th (radians) terminated in z. */
export function lineInput(z: C, zc: number, th: number): C {
  const s = Math.sin(th)
  const co = Math.cos(th)
  // Zc (Z cos + j Zc sin) / (Zc cos + j Z sin)
  const num = add(scale(z, co), c(0, zc * s))
  const den = add(c(zc * co), mul(c(0, s), z))
  return scale(div(num, den), zc)
}

/** Apply one element, optionally only fraction k (0..1) of it (for drawing the path). */
export function applyElement(z: C, el: Element, f: number, f0: number, k = 1): C {
  if (el.type === 'line') return lineInput(z, el.z0, deg2rad(el.deg) * (f / f0) * k)
  const imm = scale(elementImmittance(el, f, f0), k)
  if (el.mount === 'series') return add(z, imm)
  return inv(add(inv(z), imm))
}

export function inputImpedance(zl: C, els: Element[], f: number, f0: number): C {
  let z = zl
  for (const el of els) z = applyElement(z, el, f, f0)
  return z
}

export interface PathSegment {
  /** Index into the element list. */
  index: number
  /** Points in the Γ plane relative to z0. */
  points: C[]
}

/** The locus on the Smith chart while each element is applied in turn, at f0. */
export function trajectory(zl: C, els: Element[], f0: number, z0: number, steps = 60): PathSegment[] {
  const out: PathSegment[] = []
  let z = zl
  els.forEach((el, index) => {
    const n = el.type === 'line' || el.type === 'stub' ? Math.max(steps, Math.ceil(Math.abs(el.deg) / 3)) : steps
    const points: C[] = []
    for (let i = 0; i <= n; i++) points.push(zToGamma(applyElement(z, el, f0, f0, i / n), z0))
    out.push({ index, points })
    z = applyElement(z, el, f0, f0)
  })
  return out
}

export interface SweepPoint {
  f: number
  gamma: C
  vswr: number
}

export function sweep(zl: C, els: Element[], f0: number, z0: number, fLo: number, fHi: number, n = 201): SweepPoint[] {
  const out: SweepPoint[] = []
  for (let i = 0; i < n; i++) {
    const f = fLo + ((fHi - fLo) * i) / (n - 1)
    const gamma = zToGamma(inputImpedance(zl, els, f, f0), z0)
    out.push({ f, gamma, vswr: vswrFromGamma(gamma) })
  }
  return out
}

/** Contiguous band around f0 where VSWR stays at or below `limit`; null if f0 itself exceeds it. */
export function vswrBand(zl: C, els: Element[], f0: number, z0: number, limit = 2, span = 0.6): { lo: number; hi: number } | null {
  const n = 481
  const pts = sweep(zl, els, f0, z0, f0 * (1 - span), f0 * (1 + span), n)
  const mid = Math.round((n - 1) / 2)
  if (pts[mid].vswr > limit) return null
  let lo = mid
  let hi = mid
  while (lo > 0 && pts[lo - 1].vswr <= limit) lo--
  while (hi < n - 1 && pts[hi + 1].vswr <= limit) hi++
  return { lo: pts[lo].f, hi: pts[hi].f }
}

export const gammaAt = (zl: C, els: Element[], f: number, f0: number, z0: number): C => zToGamma(inputImpedance(zl, els, f, f0), z0)
export const magAt = (zl: C, els: Element[], f0: number, z0: number): number => abs(gammaAt(zl, els, f0, f0, z0))

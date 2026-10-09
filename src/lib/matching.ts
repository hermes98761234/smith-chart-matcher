import { abs, arg, c, inv, type C } from './complex'
import type { Element } from './network'
import { zToGamma } from './rf'

export type Pass = 'lowpass' | 'highpass' | 'bandpass'

export interface Solution {
  id: string
  family: 'L' | 'Pi' | 'T' | 'stub' | 'qwt'
  elements: Element[]
  /** Filter character, where meaningful. */
  pass?: Pass
  /** Where the first element sits, for L-networks. */
  first?: 'shunt' | 'series'
  /** Stub or transformer data. */
  mount?: 'series' | 'shunt'
  open?: boolean
  /** Distance from the load, in wavelengths. */
  d?: number
  /** Stub length, in wavelengths. */
  l?: number
  /** Quarter-wave section impedance. */
  zt?: number
  q?: number
}

const EPS = 1e-9
const TWO_PI = 2 * Math.PI

/** Lumped element realising a series reactance X (ohm) or shunt susceptance B (S) at f; null when negligible. */
export function reactive(mount: 'series' | 'shunt', x: number, f: number): Element | null {
  const w = TWO_PI * f
  if (!Number.isFinite(x)) return null
  if (mount === 'series') {
    if (Math.abs(x) < 1e-9) return null
    return x > 0 ? { type: 'L', mount, value: x / w } : { type: 'C', mount, value: -1 / (w * x) }
  }
  if (Math.abs(x) < 1e-12) return null
  return x > 0 ? { type: 'C', mount, value: x / w } : { type: 'L', mount, value: -1 / (w * x) }
}

const compact = (els: (Element | null)[]): Element[] => els.filter((e): e is Element => e !== null)

function classify(els: Element[]): Pass {
  const s = els.find((e) => e.type !== 'line' && e.type !== 'stub' && e.mount === 'series')
  const p = els.find((e) => e.type !== 'line' && e.type !== 'stub' && e.mount === 'shunt')
  if (s?.type === 'L' && p?.type === 'C') return 'lowpass'
  if (s?.type === 'C' && p?.type === 'L') return 'highpass'
  return 'bandpass'
}

/** All L-network solutions (two topologies, two each when they exist). Elements run load to source. */
export function lNetworks(zl: C, z0: number, f: number): Solution[] {
  const out: Solution[] = []
  const R = Math.max(zl.re, 1e-9)
  const X = zl.im
  const den = R * R + X * X
  const G = R / den
  const B = -X / den
  const Y0 = 1 / z0

  // Shunt element at the load, then series element: needs the load admittance inside the g = 1 circle.
  if (G <= Y0 * (1 + EPS)) {
    const bt = Math.sqrt(Math.max(G / z0 - G * G, 0))
    for (const sign of [1, -1]) {
      const Bt = sign * bt
      if (bt === 0 && sign === -1) continue
      const Xt = -Bt / (G * G + Bt * Bt)
      const els = compact([reactive('shunt', Bt - B, f), reactive('series', -Xt, f)])
      out.push({ id: `L-shunt-${sign > 0 ? 'a' : 'b'}`, family: 'L', first: 'shunt', elements: els, pass: classify(els) })
    }
  }
  // Series element at the load, then shunt element: needs the load resistance below Z0.
  if (R <= z0 * (1 + EPS)) {
    const xt = Math.sqrt(Math.max(R * (z0 - R), 0))
    for (const sign of [1, -1]) {
      const Xt = sign * xt
      if (xt === 0 && sign === -1) continue
      const Bp = Xt / (R * R + Xt * Xt)
      const els = compact([reactive('series', Xt - X, f), reactive('shunt', Bp, f)])
      out.push({ id: `L-series-${sign > 0 ? 'a' : 'b'}`, family: 'L', first: 'series', elements: els, pass: classify(els) })
    }
  }
  return out
}

/** Smallest Q for which a π or T network exists (the virtual resistance has to fit below or above both ends). */
export function minPiTQ(zl: C, z0: number, kind: 'Pi' | 'T'): number {
  const [lo, hi] = ends(zl, z0, kind)
  return Math.sqrt(Math.max(hi / lo - 1, 0))
}

function ends(zl: C, z0: number, kind: 'Pi' | 'T'): [number, number] {
  const R = Math.max(zl.re, 1e-9)
  const rl = kind === 'Pi' ? (R * R + zl.im * zl.im) / R : R // parallel-equivalent resistance for π
  return [Math.min(z0, rl), Math.max(z0, rl)]
}

/** π network (shunt-series-shunt) for loaded Q `q`; null if q is below the minimum. */
export function piNetwork(zl: C, z0: number, f: number, q: number, pass: 'lowpass' | 'highpass'): Solution | null {
  const R = Math.max(zl.re, 1e-9)
  const den = R * R + zl.im * zl.im
  const Rl = den / R
  const Bl = -zl.im / den
  const hi = Math.max(z0, Rl)
  const rv = hi / (q * q + 1)
  if (!(q >= 0) || rv > Math.min(z0, Rl) * (1 + EPS)) return null
  const qs = Math.sqrt(Math.max(z0 / rv - 1, 0))
  const ql = Math.sqrt(Math.max(Rl / rv - 1, 0))
  const sg = pass === 'lowpass' ? 1 : -1
  const elements = compact([reactive('shunt', (sg * ql) / Rl - Bl, f), reactive('series', sg * (qs + ql) * rv, f), reactive('shunt', (sg * qs) / z0, f)])
  return { id: `Pi-${pass}`, family: 'Pi', pass, elements, q }
}

/** T network (series-shunt-series) for loaded Q `q`; null if q is below the minimum. */
export function tNetwork(zl: C, z0: number, f: number, q: number, pass: 'lowpass' | 'highpass'): Solution | null {
  const R = Math.max(zl.re, 1e-9)
  const lo = Math.min(z0, R)
  const rv = lo * (q * q + 1)
  if (!(q >= 0) || rv < Math.max(z0, R) * (1 - EPS)) return null
  const qs = Math.sqrt(Math.max(rv / z0 - 1, 0))
  const ql = Math.sqrt(Math.max(rv / R - 1, 0))
  const sg = pass === 'lowpass' ? 1 : -1
  const elements = compact([reactive('series', sg * ql * R - zl.im, f), reactive('shunt', (sg * (qs + ql)) / rv, f), reactive('series', sg * qs * z0, f)])
  return { id: `T-${pass}`, family: 'T', pass, elements, q }
}

/**
 * Single-stub tuning core. Works on normalised "load" (a + jb) with reference n, returning for each
 * solution the distance (in wavelengths) and the compensation c that must be added, in the dual unit.
 * Shunt stubs: (a, b) = (R, X) ohms, n = Z0, c = stub susceptance (S).
 * Series stubs: (a, b) = (G, B) siemens, n = Y0, c = stub reactance (ohm).
 */
function stubCore(a: number, b: number, n: number): { d: number; comp: number }[] {
  const ts: number[] = []
  if (Math.abs(a - n) < n * 1e-9) ts.push(-b / (2 * n))
  else {
    const root = Math.sqrt((a * ((n - a) ** 2 + b * b)) / n)
    ts.push((b + root) / (a - n), (b - root) / (a - n))
  }
  return ts
    .map((t) => {
      const d = (t >= 0 ? Math.atan(t) : Math.PI + Math.atan(t)) / TWO_PI
      const bb = (a * a * t - (n - b * t) * (b + n * t)) / (n * (a * a + (b + n * t) ** 2))
      return { d: d % 0.5, comp: -bb }
    })
    .sort((p, q) => p.d - q.d)
}

const modPi = (x: number) => ((x % Math.PI) + Math.PI) % Math.PI

/** Stub length in wavelengths giving the requested shunt susceptance (S) or series reactance (ohm). */
export function stubLength(mount: 'series' | 'shunt', open: boolean, comp: number, z0: number): number {
  let th: number
  if (mount === 'shunt') {
    // open: B = Y0 tan θ; short: B = -Y0 cot θ
    th = open ? Math.atan(comp * z0) : Math.atan2(-1, comp * z0)
  } else {
    // open: X = -Z0 cot θ; short: X = Z0 tan θ
    th = open ? Math.atan2(-1, comp / z0) : Math.atan(comp / z0)
  }
  return modPi(th) / TWO_PI
}

/** Single shunt or series stub, open or short. Each combination has two solutions. */
export function stubSolutions(zl: C, z0: number): Solution[] {
  const R = Math.max(zl.re, 1e-9)
  const den = R * R + zl.im * zl.im
  const out: Solution[] = []
  for (const mount of ['shunt', 'series'] as const) {
    const sols = mount === 'shunt' ? stubCore(R, zl.im, z0) : stubCore(R / den, -zl.im / den, 1 / z0)
    sols.forEach((s, i) => {
      for (const open of [true, false]) {
        const l = stubLength(mount, open, s.comp, z0)
        out.push({
          id: `stub-${mount}-${open ? 'open' : 'short'}-${i}`,
          family: 'stub',
          mount,
          open,
          d: s.d,
          l,
          elements: compact([s.d > 1e-9 ? { type: 'line', z0, deg: s.d * 360 } : null, { type: 'stub', mount, open, z0, deg: l * 360 }]),
        })
      }
    })
  }
  return out
}

/** Quarter-wave transformer after a line section that brings the load to a real impedance (voltage max or min). */
export function quarterWave(zl: C, z0: number): Solution[] {
  const g = zToGamma(zl, z0)
  const m = abs(g)
  if (m < 1e-6) return []
  const s = (1 + m) / (1 - m)
  const th = arg(g)
  const out: Solution[] = []
  const wrap = (x: number) => ((x % 0.5) + 0.5) % 0.5
  const cases: [string, number, number][] = [
    ['max', wrap(th / (4 * Math.PI)), z0 * s],
    ['min', wrap((th - Math.PI) / (4 * Math.PI)), z0 / s],
  ]
  for (const [k, dRaw, rd] of cases) {
    const d = dRaw < 1e-9 || dRaw > 0.5 - 1e-9 ? 0 : dRaw
    const zt = Math.sqrt(z0 * rd)
    out.push({ id: `qwt-${k}`, family: 'qwt', d, zt, elements: compact([d > 0 ? { type: 'line', z0, deg: d * 360 } : null, { type: 'line', z0: zt, deg: 90 }]) })
  }
  return out.sort((p, q) => (p.d ?? 0) - (q.d ?? 0))
}

export function allSolutions(zl: C, z0: number, f: number, q: number): Solution[] {
  if (abs(zToGamma(zl, z0)) < 1e-6) return []
  const out: Solution[] = [...lNetworks(zl, z0, f)]
  for (const pass of ['lowpass', 'highpass'] as const) {
    const p = piNetwork(zl, z0, f, q, pass)
    if (p) out.push(p)
  }
  for (const pass of ['lowpass', 'highpass'] as const) {
    const t = tNetwork(zl, z0, f, q, pass)
    if (t) out.push(t)
  }
  out.push(...stubSolutions(zl, z0), ...quarterWave(zl, z0))
  return out
}

/** Admittance of a load, handy for callers that want to show it. */
export const admittance = (zl: C): C => inv(zl.re === 0 && zl.im === 0 ? c(1e-9) : zl)

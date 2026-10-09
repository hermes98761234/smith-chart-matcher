import { describe, expect, it } from 'vitest'
import { abs, c } from './complex'
import { allSolutions, lNetworks, minPiTQ, piNetwork, quarterWave, reactive, stubLength, stubSolutions, tNetwork, type Solution } from './matching'
import { inputImpedance } from './network'
import { zToGamma } from './rf'

const f = 500e6
const gammaOf = (zl: ReturnType<typeof c>, s: Solution, z0: number, freq = f) => abs(zToGamma(inputImpedance(zl, s.elements, freq, freq), z0))

describe('L networks', () => {
  it('Pozar example 5.1: ZL = 200 - j100, Z0 = 100, 500 MHz', () => {
    const zl = c(200, -100)
    const sols = lNetworks(zl, 100, f)
    // R_L > Z0: only the shunt-at-load topology exists
    expect(sols).toHaveLength(2)
    expect(sols.every((s) => s.first === 'shunt')).toBe(true)
    const a = sols.find((s) => s.id.endsWith('-a'))!
    // B = 0.0029 S (C = 0.92 pF), X = 122.5 ohm (L = 39 nH)
    const sh = a.elements[0]
    const se = a.elements[1]
    expect(sh).toMatchObject({ type: 'C', mount: 'shunt' })
    expect(se).toMatchObject({ type: 'L', mount: 'series' })
    const w = 2 * Math.PI * f
    expect((sh as { value: number }).value * w).toBeCloseTo(0.0029, 4)
    expect((sh as { value: number }).value).toBeCloseTo(0.92e-12, 14)
    expect((se as { value: number }).value * w).toBeCloseTo(122.5, 1)
    expect((se as { value: number }).value).toBeCloseTo(39e-9, 9)
    expect(a.pass).toBe('lowpass')
    // the other solution: B = -0.0069 S, X = -122.5
    const b = sols.find((s) => s.id.endsWith('-b'))!
    expect(b.elements[0]).toMatchObject({ type: 'L', mount: 'shunt' })
    expect(b.elements[1]).toMatchObject({ type: 'C', mount: 'series' })
    expect(b.pass).toBe('highpass')
    for (const s of sols) expect(gammaOf(zl, s, 100)).toBeLessThan(1e-9)
  })
  it('low load resistance uses series-then-shunt: 25 ohm to 50 ohm', () => {
    const sols = lNetworks(c(25), 50, 100e6)
    expect(sols).toHaveLength(2)
    expect(sols.every((s) => s.first === 'series')).toBe(true)
    const w = 2 * Math.PI * 100e6
    const lp = sols.find((s) => s.pass === 'lowpass')!
    expect((lp.elements[0] as { value: number }).value * w).toBeCloseTo(25, 6)
    expect((lp.elements[1] as { value: number }).value * w).toBeCloseTo(0.02, 6)
    for (const s of sols) expect(gammaOf(c(25), s, 50, 100e6)).toBeLessThan(1e-9)
  })
  it('both topologies exist when the load is inside both circles', () => {
    const zl = c(40, 30)
    const sols = lNetworks(zl, 50, 100e6)
    expect(sols.length).toBe(4)
    for (const s of sols) expect(gammaOf(zl, s, 50, 100e6)).toBeLessThan(1e-9)
  })
  it('every solution matches over a grid of random-ish loads', () => {
    for (const re of [3, 12, 50, 77, 300, 1500]) {
      for (const im of [-400, -60, 0, 25, 500]) {
        for (const z0 of [50, 75]) {
          const zl = c(re, im)
          for (const s of lNetworks(zl, z0, 7e6)) expect(gammaOf(zl, s, z0, 7e6), `${re}+j${im}/${z0} ${s.id}`).toBeLessThan(1e-7)
        }
      }
    }
  })
  it('real load equal to Z0 needs nothing', () => {
    expect(allSolutions(c(50), 50, 1e8, 3)).toEqual([])
  })
  it('reactive() picks L or C by sign', () => {
    expect(reactive('series', 62.83, 1e8)).toMatchObject({ type: 'L' })
    expect(reactive('series', -62.83, 1e8)).toMatchObject({ type: 'C' })
    expect(reactive('shunt', 0.01, 1e8)).toMatchObject({ type: 'C' })
    expect(reactive('shunt', -0.01, 1e8)).toMatchObject({ type: 'L' })
    expect(reactive('series', 0, 1e8)).toBeNull()
  })
})

describe('pi and T networks', () => {
  it('pi network: 50 to 10 ohm, Q = 5 (textbook virtual resistance 50/26 ohm)', () => {
    const s = piNetwork(c(10), 50, 14e6, 5, 'lowpass')!
    expect(s.elements).toHaveLength(3)
    const w = 2 * Math.PI * 14e6
    const rv = 50 / 26
    // series reactance = (Qs + Ql) * Rv with Qs = 5, Ql = sqrt(10/rv - 1)
    const ql = Math.sqrt(10 / rv - 1)
    expect((s.elements[1] as { value: number }).value * w).toBeCloseTo((5 + ql) * rv, 6)
    expect(gammaOf(c(10), s, 50, 14e6)).toBeLessThan(1e-9)
  })
  it('pi and T match for both passes, with complex loads', () => {
    for (const zl of [c(10), c(200), c(35, 40), c(120, -80)]) {
      for (const pass of ['lowpass', 'highpass'] as const) {
        const p = piNetwork(zl, 50, 7e6, 8, pass)!
        const t = tNetwork(zl, 50, 7e6, 8, pass)!
        expect(p).not.toBeNull()
        expect(t).not.toBeNull()
        expect(gammaOf(zl, p, 50, 7e6)).toBeLessThan(1e-8)
        expect(gammaOf(zl, t, 50, 7e6)).toBeLessThan(1e-8)
      }
    }
  })
  it('refuses a Q below the minimum', () => {
    const qmin = minPiTQ(c(10), 50, 'Pi')
    expect(qmin).toBeCloseTo(2, 6)
    expect(piNetwork(c(10), 50, 1e7, 1.9, 'lowpass')).toBeNull()
    expect(tNetwork(c(10), 50, 1e7, 1.9, 'lowpass')).toBeNull()
    expect(piNetwork(c(10), 50, 1e7, 2.0, 'lowpass')).not.toBeNull()
  })
  it('low-pass pi is shunt C, series L, shunt C', () => {
    const p = piNetwork(c(100), 50, 1e7, 4, 'lowpass')!
    expect(p.elements.map((e) => e.type)).toEqual(['C', 'L', 'C'])
    const h = piNetwork(c(100), 50, 1e7, 4, 'highpass')!
    expect(h.elements.map((e) => e.type)).toEqual(['L', 'C', 'L'])
  })
})

describe('stubs', () => {
  it('shunt stub on a 100 ohm load, Z0 = 50: tan(bd) = +-sqrt(R/Z0)', () => {
    const sols = stubSolutions(c(100), 50).filter((s) => s.mount === 'shunt' && s.open)
    expect(sols).toHaveLength(2)
    const d = sols.map((s) => s.d!).sort()
    const d0 = Math.atan(Math.SQRT2) / (2 * Math.PI)
    expect(d0).toBeCloseTo(0.152, 3)
    expect(d[0]).toBeCloseTo(d0, 9)
    expect(d[1]).toBeCloseTo(0.5 - d0, 9)
  })
  it('every stub solution matches, complex loads, both mounts', () => {
    for (const zl of [c(15, 10), c(60, -80), c(100), c(50, 30), c(200, 150), c(10, -5)]) {
      const sols = stubSolutions(zl, 50)
      expect(sols).toHaveLength(zl.re === 50 ? 6 : 8)
      for (const s of sols) expect(gammaOf(zl, s, 50), `${zl.re}+j${zl.im} ${s.id}`).toBeLessThan(1e-7)
    }
  })
  it('stub lengths are within half a wavelength', () => {
    for (const s of stubSolutions(c(15, 10), 50)) {
      expect(s.l!).toBeGreaterThanOrEqual(0)
      expect(s.l!).toBeLessThan(0.5)
      expect(s.d!).toBeLessThan(0.5)
    }
  })
  it('stubLength: open stub for +j0.02 S at Z0 = 50 is 45 degrees', () => {
    expect(stubLength('shunt', true, 0.02, 50)).toBeCloseTo(0.125, 6)
    expect(stubLength('shunt', false, 0.02, 50)).toBeCloseTo(0.375, 6)
    expect(stubLength('series', false, 50, 50)).toBeCloseTo(0.125, 6)
  })
})

describe('quarter-wave transformer', () => {
  it('real load: Zt = sqrt(Z0 RL)', () => {
    const sols = quarterWave(c(100), 50)
    const direct = sols.find((s) => s.d === 0)!
    expect(direct.zt).toBeCloseTo(Math.sqrt(5000), 6)
    expect(direct.elements).toHaveLength(1)
    expect(direct.elements[0]).toMatchObject({ type: 'line', deg: 90 })
    for (const s of sols) expect(gammaOf(c(100), s, 50)).toBeLessThan(1e-9)
  })
  it('complex load matches through the line section', () => {
    for (const zl of [c(60, -80), c(15, 10), c(30, 90)]) {
      const sols = quarterWave(zl, 50)
      expect(sols).toHaveLength(2)
      for (const s of sols) expect(gammaOf(zl, s, 50)).toBeLessThan(1e-9)
    }
  })
})

describe('allSolutions', () => {
  it('lists every family for a typical load', () => {
    const sols = allSolutions(c(40, 30), 50, 1e8, 5)
    const fams = new Set(sols.map((s) => s.family))
    expect([...fams].sort()).toEqual(['L', 'Pi', 'qwt', 'stub'].concat('T').sort())
    for (const s of sols) expect(gammaOf(c(40, 30), s, 50, 1e8), s.id).toBeLessThan(1e-7)
  })
})

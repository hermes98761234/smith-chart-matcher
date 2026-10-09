import { describe, expect, it } from 'vitest'
import { abs, c } from './complex'
import { applyElement, inputImpedance, lineInput, sweep, trajectory, vswrBand, type Element } from './network'
import { zToGamma } from './rf'

const f0 = 100e6

describe('elements', () => {
  it('quarter-wave line inverts: Zin = Zc^2 / ZL', () => {
    const z = lineInput(c(100), 50, Math.PI / 2)
    expect(z.re).toBeCloseTo(25, 6)
    expect(z.im).toBeCloseTo(0, 6)
  })
  it('half-wave line repeats the load', () => {
    const z = lineInput(c(30, 40), 50, Math.PI)
    expect(z.re).toBeCloseTo(30, 6)
    expect(z.im).toBeCloseTo(40, 6)
  })
  it('short-circuited line of 45 degrees looks like +jZ0', () => {
    const z = lineInput(c(0), 50, Math.PI / 4)
    expect(z.re).toBeCloseTo(0, 6)
    expect(z.im).toBeCloseTo(50, 6)
  })
  it('series L adds jwL, shunt C adds jwC', () => {
    const w = 2 * Math.PI * f0
    const a = applyElement(c(50), { type: 'L', mount: 'series', value: 100e-9 }, f0, f0)
    expect(a.im).toBeCloseTo(w * 100e-9)
    const b = applyElement(c(50), { type: 'C', mount: 'shunt', value: 10e-12 }, f0, f0)
    // Y = 1/50 + jwC
    const yRe = 1 / 50
    const yIm = w * 10e-12
    const d = yRe * yRe + yIm * yIm
    expect(b.re).toBeCloseTo(yRe / d, 6)
    expect(b.im).toBeCloseTo(-yIm / d, 6)
  })
  it('stubs: shunt open stub of 45 degrees adds +jY0', () => {
    const el: Element = { type: 'stub', mount: 'shunt', open: true, z0: 50, deg: 45 }
    const z = applyElement(c(50), el, f0, f0)
    // Y = 0.02 + j0.02
    expect(z.re).toBeCloseTo(25, 6)
    expect(z.im).toBeCloseTo(-25, 6)
  })
  it('series short stub of 45 degrees adds +jZ0', () => {
    const z = applyElement(c(50), { type: 'stub', mount: 'series', open: false, z0: 50, deg: 45 }, f0, f0)
    expect(z.re).toBeCloseTo(50, 6)
    expect(z.im).toBeCloseTo(50, 6)
  })
  it('electrical length scales with frequency', () => {
    const z = applyElement(c(0), { type: 'line', z0: 50, deg: 45 }, 2 * f0, f0)
    // 90 degrees at 2*f0: a short becomes an open
    expect(Math.abs(z.im)).toBeGreaterThan(1e9)
  })
})

describe('trajectory and sweep', () => {
  it('starts at the load and ends at the network input', () => {
    const zl = c(20, -15)
    const els: Element[] = [
      { type: 'L', mount: 'series', value: 50e-9 },
      { type: 'C', mount: 'shunt', value: 5e-12 },
    ]
    const path = trajectory(zl, els, f0, 50)
    expect(path).toHaveLength(2)
    const g0 = zToGamma(zl, 50)
    expect(path[0].points[0].re).toBeCloseTo(g0.re)
    const gEnd = zToGamma(inputImpedance(zl, els, f0, f0), 50)
    const last = path[1].points[path[1].points.length - 1]
    expect(last.re).toBeCloseTo(gEnd.re)
    expect(last.im).toBeCloseTo(gEnd.im)
    // consecutive segments join up
    expect(path[0].points.at(-1)!.re).toBeCloseTo(path[1].points[0].re)
  })
  it('sweep covers the band and is perfect for a matched load', () => {
    const pts = sweep(c(50), [], f0, 50, 80e6, 120e6, 5)
    expect(pts).toHaveLength(5)
    expect(pts[0].f).toBeCloseTo(80e6)
    expect(pts[4].f).toBeCloseTo(120e6)
    expect(abs(pts[2].gamma)).toBeCloseTo(0)
    expect(pts[2].vswr).toBeCloseTo(1)
  })
  it('VSWR band: matched load gives the whole span, bad load gives none', () => {
    const b = vswrBand(c(50), [], f0, 50)!
    expect(b.lo).toBeCloseTo(f0 * 0.4)
    expect(vswrBand(c(200), [], f0, 50)).toBeNull()
  })
})

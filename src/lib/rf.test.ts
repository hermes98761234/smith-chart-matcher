import { describe, expect, it } from 'vitest'
import { abs, arg, c } from './complex'
import { gammaMagFromReturnLoss, gammaMagFromVswr, gammaToZ, mismatchLossDb, rad2deg, returnLossDb, vswrFromGamma, zToGamma } from './rf'

describe('reflection coefficient', () => {
  it('Pozar-style example: ZL = 100 + j50 on 50 ohm', () => {
    const g = zToGamma(c(100, 50), 50)
    expect(abs(g)).toBeCloseTo(0.4472, 4)
    expect(rad2deg(arg(g))).toBeCloseTo(26.565, 2)
    expect(vswrFromGamma(g)).toBeCloseTo(2.618, 3)
    expect(returnLossDb(g)).toBeCloseTo(6.99, 2)
  })
  it('landmarks of the chart', () => {
    expect(zToGamma(c(50), 50)).toEqual(c(0, 0))
    expect(zToGamma(c(0), 50).re).toBeCloseTo(-1)
    expect(zToGamma(c(1e15), 50).re).toBeCloseTo(1)
    const j = zToGamma(c(0, 50), 50)
    expect(abs(j)).toBeCloseTo(1)
    expect(rad2deg(arg(j))).toBeCloseTo(90)
  })
  it('round-trips through Γ', () => {
    const z = gammaToZ(zToGamma(c(23, -47), 75), 75)
    expect(z.re).toBeCloseTo(23, 6)
    expect(z.im).toBeCloseTo(-47, 6)
  })
  it('VSWR, return loss, mismatch loss', () => {
    expect(vswrFromGamma(1 / 3)).toBeCloseTo(2)
    expect(vswrFromGamma(1)).toBe(Infinity)
    expect(gammaMagFromVswr(2)).toBeCloseTo(1 / 3)
    expect(gammaMagFromReturnLoss(20)).toBeCloseTo(0.1)
    expect(returnLossDb(0.1)).toBeCloseTo(20)
    expect(mismatchLossDb(1 / 3)).toBeCloseTo(0.5115, 3)
  })
})

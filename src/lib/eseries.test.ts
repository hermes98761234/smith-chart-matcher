import { describe, expect, it } from 'vitest'
import { errorPct, nearestE, roundElements } from './eseries'
import { fmtNum, fmtSI, siParts } from './format'

describe('E series', () => {
  it('rounds to the nearest preferred value', () => {
    expect(nearestE(4.5, 'E12')).toBe(4.7)
    expect(nearestE(0.923e-12, 'E24')).toBe(0.91e-12)
    expect(nearestE(38.98e-9, 'E12')).toBe(39e-9)
    expect(nearestE(38.98e-9, 'E24')).toBe(39e-9)
    expect(nearestE(9.8, 'E24')).toBe(10)
    expect(nearestE(95, 'E12')).toBe(100)
    expect(nearestE(1.04, 'E24')).toBe(1)
  })
  it('E24 values only differ from E12 where the series differ', () => {
    expect(nearestE(5.1, 'E12')).toBe(4.7)
    expect(nearestE(5.1, 'E24')).toBe(5.1)
  })
  it('error percentage', () => {
    expect(errorPct(100, 110)).toBeCloseTo(10)
  })
})

describe('roundElements', () => {
  it('rounds lumped parts only', () => {
    const out = roundElements(
      [
        { type: 'L', mount: 'series', value: 38.98e-9 },
        { type: 'C', mount: 'shunt', value: 0.9228e-12 },
        { type: 'line', z0: 50, deg: 33.3 },
      ],
      'E12',
    )
    expect(out[0]).toMatchObject({ value: 39e-9 })
    expect(out[1]).toMatchObject({ value: 1e-12 })
    expect(out[2]).toEqual({ type: 'line', z0: 50, deg: 33.3 })
  })
})

describe('format', () => {
  it('SI prefixes', () => {
    expect(fmtSI(38.98e-9, 'H')).toBe('39 nH')
    expect(fmtSI(0.9228e-12, 'F')).toBe('0.923 pF')
    expect(fmtSI(433.5e6, 'Hz')).toBe('434 MHz')
    expect(siParts(2.2e-6).prefix).toBe('µ')
  })
  it('numbers', () => {
    expect(fmtNum(0.5)).toBe('0.5')
    expect(fmtNum(-12.3456)).toBe('−12.35')
    expect(fmtNum(Infinity)).toBe('∞')
  })
})

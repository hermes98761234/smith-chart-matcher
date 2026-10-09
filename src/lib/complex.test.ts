import { describe, expect, it } from 'vitest'
import { abs, add, arg, c, close, conj, div, inv, mul, polar, sub } from './complex'

describe('complex', () => {
  it('multiplies and divides', () => {
    expect(mul(c(1, 2), c(3, -1))).toEqual(c(5, 5))
    const q = div(c(5, 5), c(3, -1))
    expect(q.re).toBeCloseTo(1)
    expect(q.im).toBeCloseTo(2)
  })
  it('add, sub, conj, inverse', () => {
    expect(add(c(1, 1), c(2, -3))).toEqual(c(3, -2))
    expect(sub(c(1, 1), c(2, -3))).toEqual(c(-1, 4))
    expect(conj(c(1, 2))).toEqual(c(1, -2))
    const i = inv(c(0, 1))
    expect(i.re).toBeCloseTo(0)
    expect(i.im).toBeCloseTo(-1)
  })
  it('polar form', () => {
    const z = polar(2, Math.PI / 3)
    expect(abs(z)).toBeCloseTo(2)
    expect(arg(z)).toBeCloseTo(Math.PI / 3)
  })
  it('division by zero stays finite', () => {
    expect(Number.isNaN(div(c(1), c(0)).re)).toBe(false)
  })
  it('close()', () => {
    expect(close(c(1, 1), c(1 + 1e-12, 1))).toBe(true)
    expect(close(c(1, 1), c(1.1, 1))).toBe(false)
  })
})

/** Minimal complex-number toolkit (plain objects, no classes). */
export interface C {
  re: number
  im: number
}

export const c = (re: number, im = 0): C => ({ re, im })
export const ZERO: C = { re: 0, im: 0 }
export const ONE: C = { re: 1, im: 0 }

export const add = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im })
export const sub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im })
export const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re })
export const scale = (a: C, k: number): C => ({ re: a.re * k, im: a.im * k })
export const neg = (a: C): C => ({ re: -a.re, im: -a.im })
export const conj = (a: C): C => ({ re: a.re, im: -a.im })
export const abs = (a: C): number => Math.hypot(a.re, a.im)
export const arg = (a: C): number => Math.atan2(a.im, a.re)
export const polar = (mag: number, ang: number): C => ({ re: mag * Math.cos(ang), im: mag * Math.sin(ang) })

/** Division. A zero divisor gives a huge finite value instead of NaN, so a short or open circuit stays plottable. */
export function div(a: C, b: C): C {
  const den = Math.max(b.re * b.re + b.im * b.im, 1e-300)
  return { re: (a.re * b.re + a.im * b.im) / den, im: (a.im * b.re - a.re * b.im) / den }
}
export const inv = (a: C): C => div(ONE, a)

export const close = (a: C, b: C, tol = 1e-9): boolean => abs(sub(a, b)) <= tol * Math.max(1, abs(a), abs(b))

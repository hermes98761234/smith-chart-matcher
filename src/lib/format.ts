const PREFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
]

/** Rounds to `digits` significant digits and drops trailing zeros. */
export function fmtNum(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—'
  if (v === 0) return '0'
  const s = Number(v.toPrecision(digits))
  const a = Math.abs(s)
  if (a >= 1e6 || a < 1e-3) return s.toExponential(Math.max(digits - 1, 0)).replace(/\.?0+e/, 'e').replace('e+', 'e').replace('-', '−')
  return String(s).replace('-', '−')
}

/** Picks the SI prefix that leaves a mantissa in [1, 1000). */
export function siParts(v: number): { mant: number; scale: number; prefix: string } {
  if (v === 0 || !Number.isFinite(v)) return { mant: v, scale: 1, prefix: '' }
  const a = Math.abs(v)
  for (const [scale, prefix] of PREFIXES) if (a >= scale * 0.9995) return { mant: v / scale, scale, prefix }
  const [scale, prefix] = PREFIXES[PREFIXES.length - 1]
  return { mant: v / scale, scale, prefix }
}

export function fmtSI(v: number, unit: string, digits = 3): string {
  const { mant, prefix } = siParts(v)
  return `${fmtNum(mant, digits)} ${prefix}${unit}`
}

export const fmtDeg = (v: number, digits = 4): string => `${fmtNum(v, digits)}°`

/** "R + jX" with float dust removed (|v| below 1e-6 shows as 0). */
export function fmtZ(re: number, im: number, digits = 4): string {
  const clean = (v: number) => (Math.abs(v) < 1e-6 ? 0 : v)
  const r = clean(re)
  const x = clean(im)
  return `${fmtNum(r, digits)} ${x < 0 ? '−' : '+'} j${fmtNum(Math.abs(x), digits)}`
}

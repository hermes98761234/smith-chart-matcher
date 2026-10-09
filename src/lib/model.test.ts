import { afterEach, describe, expect, it, vi } from 'vitest'
import { bestScale, DEFAULTS, loadState, saveState } from './model'

function fakeStorage(initial?: string) {
  const store = new Map<string, string>()
  if (initial !== undefined) store.set('smith-chart-matcher:v1', initial)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  })
  return store
}

afterEach(() => vi.unstubAllGlobals())

describe('state persistence', () => {
  it('falls back to defaults on nothing or garbage', () => {
    fakeStorage()
    expect(loadState()).toEqual(DEFAULTS)
    fakeStorage('{not json')
    expect(loadState()).toEqual(DEFAULTS)
  })
  it('round-trips', () => {
    const store = fakeStorage()
    const s = { ...DEFAULTS, nextId: 2, z0: 75, lang: 'uk' as const, manual: [{ id: 1, el: { type: 'L' as const, mount: 'series' as const, value: 1e-8 }, scale: 1e-9 }] }
    saveState(s)
    expect(store.size).toBe(1)
    expect(loadState()).toEqual(s)
  })
  it('sanitises bad values', () => {
    fakeStorage(JSON.stringify({ z0: -5, freq: 'x', lang: 'fr', zl: { re: -3, im: 1 }, manual: [{ el: { type: 'L', mount: 'up', value: 1 } }, { el: { type: 'line', z0: 50, deg: 90 } }] }))
    const s = loadState()
    expect(s.z0).toBe(DEFAULTS.z0)
    expect(s.freq).toBe(DEFAULTS.freq)
    expect(s.lang).toBe('en')
    expect(s.zl.re).toBe(DEFAULTS.zl.re)
    expect(s.manual).toHaveLength(1)
  })
})

describe('bestScale', () => {
  it('picks a sensible display unit', () => {
    expect(bestScale('L', 39e-9)).toBe(1e-9)
    expect(bestScale('C', 0.92e-12)).toBe(1e-12)
    expect(bestScale('L', 2.2e-6)).toBe(1e-6)
    expect(bestScale('R', 50)).toBe(1)
  })
})

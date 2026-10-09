import { c, type C } from './complex'
import type { Element } from './network'
import { siParts } from './format'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type LoadMode = 'z' | 'gamma' | 'rl'
export type Tab = 'auto' | 'manual'
export type ESel = 'off' | 'E12' | 'E24'

/** Display units (SI multiplier) available per lumped element type. */
export const UNITS: Record<'L' | 'C' | 'R', [string, number][]> = {
  L: [['pH', 1e-12], ['nH', 1e-9], ['µH', 1e-6], ['mH', 1e-3]],
  C: [['fF', 1e-15], ['pF', 1e-12], ['nF', 1e-9], ['µF', 1e-6]],
  R: [['mΩ', 1e-3], ['Ω', 1], ['kΩ', 1e3], ['MΩ', 1e6]],
}

export interface ManualEl {
  id: number
  el: Element
  /** Display multiplier for the value field (lumped elements only). */
  scale: number
}

export interface AppState {
  lang: Lang
  theme: Theme
  loadMode: LoadMode
  zl: C
  z0: number
  freq: number
  freqUnit: number
  vf: number
  span: number
  eSel: ESel
  q: number
  tab: Tab
  manual: ManualEl[]
  nextId: number
  showZ: boolean
  showY: boolean
  showVswr: boolean
  selected: string
}

export const DEFAULTS: AppState = {
  lang: 'en',
  theme: 'auto',
  loadMode: 'z',
  zl: c(25, 40),
  z0: 50,
  freq: 144e6,
  freqUnit: 1e6,
  vf: 0.66,
  span: 50,
  eSel: 'E24',
  q: 5,
  tab: 'auto',
  manual: [],
  nextId: 1,
  showZ: true,
  showY: false,
  showVswr: true,
  selected: '',
}

const KEY = 'smith-chart-matcher:v1'

export function bestScale(type: 'L' | 'C' | 'R', value: number): number {
  const units = UNITS[type]
  const { scale } = siParts(value)
  let best = units[0][1]
  for (const [, m] of units) if (m <= scale * 1.0005) best = m
  return best
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : d

const isElement = (e: unknown): e is Element => {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  const mountOk = o.mount === 'series' || o.mount === 'shunt'
  if (o.type === 'L' || o.type === 'C' || o.type === 'R') return mountOk && num(o.value, -1, 1e-18) > 0
  if (o.type === 'line') return num(o.z0, -1, 0.001) > 0 && num(o.deg, NaN) === o.deg
  if (o.type === 'stub') return mountOk && typeof o.open === 'boolean' && num(o.z0, -1, 0.001) > 0 && num(o.deg, NaN) === o.deg
  return false
}

export function loadState(): AppState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object') return DEFAULTS
    const d = DEFAULTS
    const zl = raw.zl as { re?: unknown; im?: unknown } | undefined
    const manual = Array.isArray(raw.manual)
      ? (raw.manual as { id?: unknown; el?: unknown; scale?: unknown }[])
          .filter((m) => isElement(m?.el))
          .map((m, i) => ({ id: i + 1, el: m.el as Element, scale: num(m.scale, 1, 1e-18) }))
      : []
    const pick = <T extends string>(v: unknown, ok: readonly T[], def: T): T => (ok.includes(v as T) ? (v as T) : def)
    return {
      lang: pick(raw.lang, ['en', 'uk'], d.lang),
      theme: pick(raw.theme, ['auto', 'light', 'dark'], d.theme),
      loadMode: pick(raw.loadMode, ['z', 'gamma', 'rl'], d.loadMode),
      zl: c(num(zl?.re, d.zl.re, 0, 1e9), num(zl?.im, d.zl.im, -1e9, 1e9)),
      z0: num(raw.z0, d.z0, 0.01, 1e6),
      freq: num(raw.freq, d.freq, 1, 1e12),
      freqUnit: [1e3, 1e6, 1e9].includes(raw.freqUnit as number) ? (raw.freqUnit as number) : d.freqUnit,
      vf: num(raw.vf, d.vf, 0.01, 1),
      span: num(raw.span, d.span, 1, 95),
      eSel: pick(raw.eSel, ['off', 'E12', 'E24'], d.eSel),
      q: num(raw.q, d.q, 0, 1000),
      tab: pick(raw.tab, ['auto', 'manual'], d.tab),
      manual,
      nextId: manual.length + 1,
      showZ: raw.showZ !== false,
      showY: raw.showY === true,
      showVswr: raw.showVswr !== false,
      selected: typeof raw.selected === 'string' ? raw.selected : '',
    }
  } catch {
    return DEFAULTS
  }
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

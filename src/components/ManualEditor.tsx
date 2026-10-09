import { useState } from 'react'
import NumberField from './NumberField'
import { PATH_COLORS } from '../lib/colors'
import { elementLabel } from './labels'
import { physicalLength } from '../lib/describe'
import { fmtSI } from '../lib/format'
import { bestScale, UNITS, type ManualEl } from '../lib/model'
import { isLumped, type Element } from '../lib/network'
import type { T } from '../i18n'

type Kind = 'L' | 'C' | 'R' | 'line' | 'open' | 'short'

interface Props {
  items: ManualEl[]
  f0: number
  z0: number
  vf: number
  t: T
  onChange: (items: ManualEl[]) => void
  nextId: () => number
}

/** A sensible starting value: a reactance of about Z0 at the design frequency. */
function make(kind: Kind, mount: 'series' | 'shunt', f0: number, z0: number): { el: Element; scale: number } {
  const w = 2 * Math.PI * f0
  if (kind === 'L') return { el: { type: 'L', mount, value: z0 / w }, scale: bestScale('L', z0 / w) }
  if (kind === 'C') return { el: { type: 'C', mount, value: 1 / (w * z0) }, scale: bestScale('C', 1 / (w * z0)) }
  if (kind === 'R') return { el: { type: 'R', mount, value: z0 }, scale: 1 }
  if (kind === 'line') return { el: { type: 'line', z0, deg: 45 }, scale: 1 }
  return { el: { type: 'stub', mount, open: kind === 'open', z0, deg: 45 }, scale: 1 }
}

const kindOf = (e: Element): Kind => (e.type === 'stub' ? (e.open ? 'open' : 'short') : e.type)

export default function ManualEditor({ items, f0, z0, vf, t, onChange, nextId }: Props) {
  const [kind, setKind] = useState<Kind>('L')
  const [mount, setMount] = useState<'series' | 'shunt'>('series')
  const set = (id: number, patch: Partial<ManualEl>) => onChange(items.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const move = (i: number, d: number) => {
    const a = [...items]
    const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    onChange(a)
  }
  return (
    <div className="manual">
      <p className="hint">{t('Elements are applied in order, starting at the load. Watch the path on the chart.')}</p>
      <div className="row add-row">
        <select aria-label={t('Connection')} value={mount} onChange={(e) => setMount(e.target.value as 'series' | 'shunt')} disabled={kind === 'line'}>
          <option value="series">{t('Series')}</option>
          <option value="shunt">{t('Shunt')}</option>
        </select>
        <select aria-label={t('Element type')} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="L">{t('Inductor L')}</option>
          <option value="C">{t('Capacitor C')}</option>
          <option value="R">{t('Resistor R')}</option>
          <option value="line">{t('Transmission line')}</option>
          <option value="open">{t('Open stub')}</option>
          <option value="short">{t('Short stub')}</option>
        </select>
        <button onClick={() => onChange([...items, { id: nextId(), ...make(kind, mount, f0, z0) }])}>{t('Add element')}</button>
        <span className="spacer" />
        <button className="danger" onClick={() => onChange([])} disabled={items.length === 0}>
          {t('Clear all')}
        </button>
      </div>
      {items.length === 0 && <p className="hint">{t('No elements yet. Add one above, or use "Edit in manual mode" on a solution.')}</p>}
      {items.map((m, i) => {
        const el = m.el
        const k = kindOf(el)
        return (
          <div className="card mrow" key={m.id}>
            <div className="row">
              <span className="dot" style={{ background: PATH_COLORS[i % PATH_COLORS.length] }}>
                {i + 1}
              </span>
              <strong>{elementLabel(el, t)}</strong>
              <span className="spacer" />
              <button className="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('Move up')}>
                ↑
              </button>
              <button className="small" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t('Move down')}>
                ↓
              </button>
              <button className="small danger" onClick={() => onChange(items.filter((x) => x.id !== m.id))} aria-label={t('Remove')}>
                ✕
              </button>
            </div>
            <div className="row">
              {el.type !== 'line' && (
                <select
                  aria-label={t('Connection')}
                  value={el.mount}
                  onChange={(e) => set(m.id, { el: { ...el, mount: e.target.value as 'series' | 'shunt' } as Element })}
                >
                  <option value="series">{t('Series')}</option>
                  <option value="shunt">{t('Shunt')}</option>
                </select>
              )}
              <select
                aria-label={t('Element type')}
                value={k}
                onChange={(e) => {
                  const nk = e.target.value as Kind
                  const mnt = el.type === 'line' ? 'series' : el.mount
                  set(m.id, make(nk, mnt, f0, z0))
                }}
              >
                <option value="L">{t('Inductor L')}</option>
                <option value="C">{t('Capacitor C')}</option>
                <option value="R">{t('Resistor R')}</option>
                <option value="line">{t('Transmission line')}</option>
                <option value="open">{t('Open stub')}</option>
                <option value="short">{t('Short stub')}</option>
              </select>
              {isLumped(el) ? (
                <>
                  <NumberField
                    className="inline"
                    ariaLabel={t('Value')}
                    value={Number((el.value / m.scale).toPrecision(6))}
                    min={1e-9}
                    onCommit={(v) => set(m.id, { el: { ...el, value: v * m.scale } })}
                  />
                  <select aria-label={t('Unit')} value={m.scale} onChange={(e) => set(m.id, { scale: Number(e.target.value) })}>
                    {UNITS[el.type].map(([u, s]) => (
                      <option key={u} value={s}>
                        {u}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <NumberField className="inline" ariaLabel={t('Electrical length (degrees)')} value={el.deg} suffix="°" onCommit={(v) => set(m.id, { el: { ...el, deg: v } })} />
                  <NumberField className="inline" ariaLabel={t('Characteristic impedance')} value={el.z0} min={0.1} suffix="Ω" onCommit={(v) => set(m.id, { el: { ...el, z0: v } })} />
                </>
              )}
            </div>
            {!isLumped(el) && <p className="hint">≈ {fmtSI(physicalLength(el.deg, f0, vf), 'm', 3)}</p>}
          </div>
        )
      })}
    </div>
  )
}

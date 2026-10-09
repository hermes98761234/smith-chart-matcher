import ElementTable from './ElementTable'
import { fmtNum, fmtSI } from '../lib/format'
import type { Solution } from '../lib/matching'
import type { T } from '../i18n'

export interface SolutionView {
  sol: Solution
  band: { lo: number; hi: number } | null
}

interface Props {
  items: SolutionView[]
  selected: string
  onSelect: (id: string) => void
  onEdit: (s: Solution) => void
  f0: number
  vf: number
  q: number
  qmin: { Pi: number; T: number }
  matched: boolean
  t: T
}

function title(s: Solution, t: T): string {
  switch (s.family) {
    case 'L':
      return s.first === 'shunt' ? t('L-network, shunt element at the load') : t('L-network, series element at the load')
    case 'Pi':
      return t('π network')
    case 'T':
      return t('T network')
    case 'stub':
      if (s.mount === 'shunt') return s.open ? t('Shunt stub, open') : t('Shunt stub, short')
      return s.open ? t('Series stub, open') : t('Series stub, short')
    case 'qwt':
      return t('Quarter-wave transformer')
  }
}

function passLabel(s: Solution, t: T): string | null {
  if (s.pass === 'lowpass') return t('Low-pass')
  if (s.pass === 'highpass') return t('High-pass')
  if (s.pass === 'bandpass') return t('Band-pass')
  return null
}

export default function SolutionList({ items, selected, onSelect, onEdit, f0, vf, q, qmin, matched, t }: Props) {
  if (matched) return <p className="verdict ok">{t('The load is already matched to Z0.')}</p>
  const groups: { key: string; heading: string; fam: Solution['family'][]; note?: string }[] = [
    { key: 'L', heading: t('L-networks'), fam: ['L'] },
    { key: 'PiT', heading: t('π and T networks (Q = {0})', fmtNum(q, 3)), fam: ['Pi', 'T'] },
    { key: 'stub', heading: t('Single stub'), fam: ['stub'] },
    { key: 'qwt', heading: t('Quarter-wave transformer'), fam: ['qwt'] },
  ]
  return (
    <div className="solutions">
      {groups.map((g) => {
        const list = items.filter((i) => g.fam.includes(i.sol.family))
        return (
          <section key={g.key} className="group">
            <h3>
              {g.heading} <span className="count">{list.length}</span>
            </h3>
            {g.key === 'PiT' && list.length < 4 && (
              <p className="hint warn-text">{t('Q must be at least {0} for this load.', fmtNum(Math.max(qmin.Pi, qmin.T), 3))}</p>
            )}
            {list.map(({ sol, band }) => {
              const pass = passLabel(sol, t)
              const on = sol.id === selected
              return (
                <article key={sol.id} className={`card sol ${on ? 'selected' : ''}`}>
                  <button className="sol-head" aria-pressed={on} onClick={() => onSelect(sol.id)}>
                    <span className="sol-title">{title(sol, t)}</span>
                    {pass && <span className={`tag ${sol.pass}`}>{pass}</span>}
                    {sol.zt !== undefined && <span className="tag">Zt = {fmtNum(sol.zt, 4)} Ω</span>}
                  </button>
                  <ElementTable elements={sol.elements} f0={f0} vf={vf} t={t} />
                  <div className="row sol-foot">
                    <span className="hint">
                      {band
                        ? t('VSWR ≤ 2: {0}% bandwidth ({1} – {2})', fmtNum(((band.hi - band.lo) / f0) * 100, 3), fmtSI(band.lo, 'Hz', 4), fmtSI(band.hi, 'Hz', 4))
                        : t('VSWR ≤ 2: not within the sweep range')}
                    </span>
                    <span className="spacer" />
                    <button className="small" onClick={() => onEdit(sol)}>
                      {t('Edit in manual mode')}
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

import { elementLabel } from './labels'
import { PATH_COLORS } from '../lib/colors'
import { errorPct, nearestE } from '../lib/eseries'
import { physicalLength } from '../lib/describe'
import { fmtNum, fmtSI } from '../lib/format'
import type { Element } from '../lib/network'
import type { T } from '../i18n'

const UNIT = { L: 'H', C: 'F', R: 'Ω' } as const

interface Props {
  elements: Element[]
  f0: number
  vf: number
  t: T
}

/** Component values with the nearest E12 and E24 parts, and electrical/physical lengths for lines. */
export default function ElementTable({ elements, f0, vf, t }: Props) {
  if (elements.length === 0) return <p className="hint">{t('No elements needed.')}</p>
  return (
    <table className="data parts">
      <thead>
        <tr>
          <th />
          <th>{t('Part')}</th>
          <th>{t('Ideal')}</th>
          <th>E12</th>
          <th>E24</th>
        </tr>
      </thead>
      <tbody>
        {elements.map((el, i) => (
          <tr key={i}>
            <td>
              <span className="dot" style={{ background: PATH_COLORS[i % PATH_COLORS.length] }}>
                {i + 1}
              </span>
            </td>
            <td>{elementLabel(el, t)}</td>
            {el.type === 'line' || el.type === 'stub' ? (
              <td colSpan={3}>
                {fmtNum(el.deg, 4)}° = {fmtNum(el.deg / 360, 4)} λ · {fmtSI(physicalLength(el.deg, f0, vf), 'm', 3)} · Z0 = {fmtNum(el.z0, 4)} Ω
              </td>
            ) : (
              <>
                <td>{fmtSI(el.value, UNIT[el.type])}</td>
                {(['E12', 'E24'] as const).map((s) => {
                  const v = nearestE(el.value, s)
                  const e = errorPct(el.value, v)
                  return (
                    <td key={s}>
                      {fmtSI(v, UNIT[el.type])} <span className="muted">({e >= 0 ? '+' : '−'}{fmtNum(Math.abs(e), 2)}%)</span>
                    </td>
                  )
                })}
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

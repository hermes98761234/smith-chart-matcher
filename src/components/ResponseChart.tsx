import { useEffect, useRef, useState } from 'react'
import { fmtNum, fmtSI } from '../lib/format'
import { s11Db, vswrFromGamma } from '../lib/rf'
import type { SweepPoint } from '../lib/network'
import type { T } from '../i18n'

interface Props {
  ideal: SweepPoint[]
  rounded: SweepPoint[] | null
  roundedLabel: string
  f0: number
  /** Optional match-without-network curve. */
  bare: SweepPoint[] | null
  t: T
}

const H = 260
const M = { l: 52, r: 14, t: 12, b: 34 }
const DB_MIN = -40
const V_MAX = 10

export default function ResponseChart({ ideal, rounded, roundedLabel, f0, bare, t }: Props) {
  const [mode, setMode] = useState<'db' | 'vswr'>('db')
  const [W, setW] = useState(720)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.round(el.clientWidth))))
    ro.observe(el)
    setW(Math.max(300, Math.round(el.clientWidth)))
    return () => ro.disconnect()
  }, [])
  const [hi, setHi] = useState<number | null>(null)
  const fLo = ideal[0].f
  const fHi = ideal[ideal.length - 1].f
  const x = (f: number) => M.l + ((f - fLo) / (fHi - fLo)) * (W - M.l - M.r)
  const val = (p: SweepPoint) => (mode === 'db' ? Math.max(s11Db(p.gamma), DB_MIN) : Math.min(p.vswr, V_MAX))
  const y = (v: number) => (mode === 'db' ? M.t + (v / DB_MIN) * (H - M.t - M.b) : M.t + ((V_MAX - v) / (V_MAX - 1)) * (H - M.t - M.b))
  const line = (pts: SweepPoint[]) => pts.map((p) => `${x(p.f).toFixed(1)},${y(val(p)).toFixed(1)}`).join(' ')
  const yTicks = mode === 'db' ? [0, -10, -20, -30, -40] : [1, 2, 3, 5, 7, 10]
  const limit = mode === 'db' ? s11Db(1 / 3) : 2
  const xt = [0, 0.25, 0.5, 0.75, 1].map((k) => fLo + k * (fHi - fLo))
  const cur = hi !== null ? ideal[hi] : null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const f = fLo + ((px - M.l) / (W - M.l - M.r)) * (fHi - fLo)
    const i = Math.round(((f - fLo) / (fHi - fLo)) * (ideal.length - 1))
    setHi(i >= 0 && i < ideal.length ? i : null)
  }

  return (
    <div className="box response">
      <div className="row">
        <h3>{t('Matched frequency response')}</h3>
        <span className="spacer" />
        <div className="seg" role="group" aria-label={t('Plot')}>
          <button className={mode === 'db' ? 'on' : ''} aria-pressed={mode === 'db'} onClick={() => setMode('db')}>
            |S11| dB
          </button>
          <button className={mode === 'vswr' ? 'on' : ''} aria-pressed={mode === 'vswr'} onClick={() => setMode('vswr')}>
            {t('VSWR')}
          </button>
        </div>
      </div>
      <div ref={wrap} className="resp-wrap">
      <svg className="resp-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Matched frequency response')} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="rgrid" />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" className="rtext">
              {v}
            </text>
          </g>
        ))}
        {xt.map((f, i) => (
          <g key={f}>
            <line x1={x(f)} x2={x(f)} y1={M.t} y2={H - M.b} className="rgrid" />
            <text x={x(f)} y={H - M.b + 16} textAnchor={i === xt.length - 1 ? 'end' : 'middle'} className="rtext">
              {fmtSI(f, 'Hz', 3)}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={y(limit)} y2={y(limit)} className="rlimit" />
        <text x={W - M.r - 4} y={y(limit) - 4} textAnchor="end" className="rtext limit-text">
          {t('VSWR 2')}
        </text>
        <line x1={x(f0)} x2={x(f0)} y1={M.t} y2={H - M.b} className="rf0" />
        {bare && <polyline points={line(bare)} className="rcurve bare" fill="none" />}
        {rounded && <polyline points={line(rounded)} className="rcurve rounded" fill="none" />}
        <polyline points={line(ideal)} className="rcurve ideal" fill="none" />
        {cur && (
          <g pointerEvents="none">
            <line x1={x(cur.f)} x2={x(cur.f)} y1={M.t} y2={H - M.b} className="rcursor" />
            <circle cx={x(cur.f)} cy={y(val(cur))} r={4} className="rdot" />
          </g>
        )}
        <text x={14} y={M.t + (H - M.t - M.b) / 2} transform={`rotate(-90 14 ${M.t + (H - M.t - M.b) / 2})`} textAnchor="middle" className="rtext">
          {mode === 'db' ? '|S11| (dB)' : t('VSWR')}
        </text>
      </svg>
      </div>
      <div className="legend">
        <span>
          <i className="sw ideal" /> {t('Ideal values')}
        </span>
        {rounded && (
          <span>
            <i className="sw rounded" /> {roundedLabel}
          </span>
        )}
        {bare && (
          <span>
            <i className="sw bare" /> {t('No matching network')}
          </span>
        )}
        <span className="spacer" />
        {cur && (
          <span className="tab-nums">
            {fmtSI(cur.f, 'Hz', 4)} · |S11| {fmtNum(s11Db(cur.gamma), 3)} dB · {t('VSWR')} {fmtNum(vswrFromGamma(cur.gamma), 3)}
          </span>
        )}
      </div>
    </div>
  )
}

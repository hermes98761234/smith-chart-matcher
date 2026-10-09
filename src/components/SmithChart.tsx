import { useEffect, useMemo, useRef, useState } from 'react'
import { abs, arg, c, type C } from '../lib/complex'
import { fmtNum, fmtZ } from '../lib/format'
import type { PathSegment } from '../lib/network'
import { gammaToZ, rad2deg, returnLossDb, vswrFromGamma, zToGamma } from '../lib/rf'
import { PATH_COLORS } from '../lib/colors'
import type { T } from '../i18n'

const R_BASE = [0.2, 0.5, 1, 2, 5]
const R_FINE = [0.1, 0.3, 0.4, 0.6, 0.8, 1.5, 3, 4, 10, 20]
const FINE_FROM = 2
const MAX_GAMMA = 0.985

interface Props {
  zl: C
  z0: number
  segments: PathSegment[]
  /** Reflection coefficient at the end of the network. */
  end: C
  showZ: boolean
  showY: boolean
  showVswr: boolean
  onShow: (k: 'showZ' | 'showY' | 'showVswr', v: boolean) => void
  onLoad: (z: C) => void
  t: T
}

interface View {
  zoom: number
  cx: number
  cy: number
}
const HOME: View = { zoom: 1, cx: 0, cy: 0 }

const f4 = (v: number) => Number(v.toFixed(5))

function Grid({ zoom, adm }: { zoom: number; adm: boolean }) {
  const rs = zoom >= FINE_FROM ? [...R_BASE, ...R_FINE] : R_BASE
  const cls = adm ? 'grid-y' : 'grid-z'
  const fs = 0.04 / Math.sqrt(zoom)
  const sgn = adm ? -1 : 1
  return (
    <g>
      <g className={cls} fill="none" clipPath="url(#smith-clip)" transform={adm ? 'scale(-1 -1)' : undefined}>
        <line x1={-1} y1={0} x2={1} y2={0} />
        {rs.map((r) => (
          <circle key={`r${r}`} cx={f4(r / (1 + r))} cy={0} r={f4(1 / (1 + r))} />
        ))}
        {rs.flatMap((x) => [
          <circle key={`xp${x}`} cx={1} cy={f4(-1 / x)} r={f4(1 / x)} />,
          <circle key={`xn${x}`} cx={1} cy={f4(1 / x)} r={f4(1 / x)} />,
        ])}
      </g>
      <g className={`${cls}-label`} fontSize={fs} textAnchor="middle">
        {rs.map((r) => (
          <text key={`lr${r}`} x={sgn * f4((r - 1) / (r + 1))} y={sgn * -0.012 + (adm ? 0.04 / Math.sqrt(zoom) : 0)}>
            {r}
          </text>
        ))}
        {rs.flatMap((x) => {
          const d = x * x + 1
          const gx = (x * x - 1) / d
          const gy = (2 * x) / d
          const k = 1.045
          const mk = (s: number, key: string) => (
            <text key={key} x={sgn * f4(gx * k)} y={sgn * f4(-s * gy * k) + fs * 0.35}>
              {s < 0 ? '−' : ''}
              {x}
            </text>
          )
          return [mk(1, `lxp${x}`), mk(-1, `lxn${x}`)]
        })}
      </g>
    </g>
  )
}

export default function SmithChart({ zl, z0, segments, end, showZ, showY, showVswr, onShow, onLoad, t }: Props) {
  const [view, setView] = useState<View>(HOME)
  const [hover, setHover] = useState<C | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ kind: 'load' } | { kind: 'pan'; x: number; y: number; view: View } | null>(null)
  const w = 2.3 / view.zoom
  const g = zToGamma(zl, z0)

  const toGamma = (e: { clientX: number; clientY: number }): C | null => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return c(p.x, -p.y)
  }

  const zoomAt = (factor: number, at?: C) => {
    setView((v) => {
      const zoom = Math.min(Math.max(v.zoom * factor, 1), 40)
      if (zoom === 1) return HOME
      const k = v.zoom / zoom
      const a = at ?? c(v.cx, -v.cy)
      // keep the point under the cursor fixed
      return { zoom, cx: a.re + (v.cx - a.re) * k, cy: -a.im + (v.cy + a.im) * k }
    })
  }
  // zoomAt only uses the functional setView, so the first render's closure stays valid for the wheel listener.
  const zoomRef = useRef(zoomAt)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const m = svg.getScreenCTM()
      if (!m) return
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
      zoomRef.current(Math.exp(-e.deltaY * 0.0015), c(p.x, -p.y))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const onDown = (kind: 'load' | 'pan') => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    setHover(null)
    drag.current = kind === 'load' ? { kind } : { kind, x: e.clientX, y: e.clientY, view }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) {
      setHover(toGamma(e))
      return
    }
    if (d.kind === 'load') {
      const p = toGamma(e)
      if (!p) return
      const m = abs(p)
      const gg = m > MAX_GAMMA ? c((p.re / m) * MAX_GAMMA, (p.im / m) * MAX_GAMMA) : p
      const z = gammaToZ(gg, z0)
      onLoad(c(Number(z.re.toPrecision(4)), Number(z.im.toPrecision(4))))
    } else {
      const rect = svgRef.current!.getBoundingClientRect()
      const k = w / Math.min(rect.width, rect.height)
      const lim = 1.15
      setView({
        zoom: d.view.zoom,
        cx: Math.max(-lim, Math.min(lim, d.view.cx - (e.clientX - d.x) * k)),
        cy: Math.max(-lim, Math.min(lim, d.view.cy - (e.clientY - d.y) * k)),
      })
    }
  }
  const onUp = () => {
    drag.current = null
  }

  const grids = useMemo(
    () => (
      <>
        {showZ && <Grid zoom={view.zoom} adm={false} />}
        {showY && <Grid zoom={view.zoom} adm />}
      </>
    ),
    [showZ, showY, view.zoom],
  )

  const sw = (px: number) => px // stroke widths use non-scaling-stroke so they are screen pixels
  const rad = (px: number) => (px * w) / 600 // marker radii in screen-ish pixels
  const shown = hover ?? g
  const zShown = hover ? gammaToZ(hover, z0) : zl
  const mag = abs(shown)
  const yShown = (() => {
    const d = zShown.re * zShown.re + zShown.im * zShown.im
    return d === 0 ? c(Infinity, 0) : c(zShown.re / d, -zShown.im / d)
  })()

  const key = (e: React.KeyboardEvent) => {
    const step = 0.01
    const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
    const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0
    if (!dx && !dy) return
    e.preventDefault()
    const p = c(g.re + dx, g.im + dy)
    const m = abs(p)
    const gg = m > MAX_GAMMA ? c((p.re / m) * MAX_GAMMA, (p.im / m) * MAX_GAMMA) : p
    const z = gammaToZ(gg, z0)
    onLoad(c(Number(z.re.toPrecision(4)), Number(z.im.toPrecision(4))))
  }

  return (
    <div className="chart-box">
      <div className="chart-tools">
        <label className="chk">
          <input type="checkbox" checked={showZ} onChange={(e) => onShow('showZ', e.target.checked)} /> {t('Impedance grid')}
        </label>
        <label className="chk">
          <input type="checkbox" checked={showY} onChange={(e) => onShow('showY', e.target.checked)} /> {t('Admittance grid')}
        </label>
        <label className="chk">
          <input type="checkbox" checked={showVswr} onChange={(e) => onShow('showVswr', e.target.checked)} /> {t('VSWR circles')}
        </label>
        <span className="spacer" />
        <span className="zoom-grp">
        <button className="small" onClick={() => zoomAt(1 / 1.5)} disabled={view.zoom <= 1} aria-label={t('Zoom out')}>
          −
        </button>
        <span className="zoom-val">{fmtNum(view.zoom, 2)}×</span>
        <button className="small" onClick={() => zoomAt(1.5)} disabled={view.zoom >= 40} aria-label={t('Zoom in')}>
          +
        </button>
        <button className="small" onClick={() => setView(HOME)} disabled={view.zoom === 1}>
          {t('Reset view')}
        </button>
        </span>
      </div>
      <svg
        ref={svgRef}
        className="smith"
        viewBox={`${f4(view.cx - w / 2)} ${f4(view.cy - w / 2)} ${f4(w)} ${f4(w)}`}
        role="img"
        aria-label={t('Smith chart. Drag the load point to change the load.')}
        onPointerDown={onDown('pan')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id="smith-clip">
            <circle cx={0} cy={0} r={1} />
          </clipPath>
        </defs>
        <circle cx={0} cy={0} r={1} className="chart-face" />
        {grids}
        {showVswr && (
          <g fill="none" className="vswr">
            {[1.5, 2, 3, 5, 10].map((s) => (
              <circle key={s} cx={0} cy={0} r={f4((s - 1) / (s + 1))} className={s === 2 ? 'vswr-2' : ''} />
            ))}
            <circle cx={0} cy={0} r={f4(abs(g))} className="vswr-load" strokeWidth={sw(1.6)} />
          </g>
        )}
        <circle cx={0} cy={0} r={1} className="chart-edge" fill="none" />
        <g className="axis-label" fontSize={0.045 / Math.sqrt(view.zoom)}>
          {showVswr &&
            [2].map((s) => (
              <text key={s} x={f4((s - 1) / (s + 1))} y={0.05 / Math.sqrt(view.zoom)} textAnchor="start" className="vswr-label">
                {t('VSWR 2')}
              </text>
            ))}
        </g>
        {segments.map((seg) => (
          <polyline
            key={seg.index}
            className="path"
            fill="none"
            stroke={PATH_COLORS[seg.index % PATH_COLORS.length]}
            strokeWidth={sw(2.6)}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={seg.points.map((p) => `${f4(p.re)},${f4(-p.im)}`).join(' ')}
          />
        ))}
        {segments.map((seg) => {
          const p = seg.points[seg.points.length - 1]
          const col = PATH_COLORS[seg.index % PATH_COLORS.length]
          return (
            <g key={`m${seg.index}`} pointerEvents="none">
              <circle cx={f4(p.re)} cy={f4(-p.im)} r={rad(9)} fill={col} />
              <text x={f4(p.re)} y={f4(-p.im) + rad(3.6)} fontSize={rad(10.5)} textAnchor="middle" className="marker-text">
                {seg.index + 1}
              </text>
            </g>
          )
        })}
        <g pointerEvents="none">
          <circle cx={0} cy={0} r={rad(3)} className="center-dot" />
          <circle cx={f4(end.re)} cy={f4(-end.im)} r={rad(5)} className="end-dot" fill="none" strokeWidth={sw(2)} />
        </g>
        <g
          className="load"
          tabIndex={0}
          role="slider"
          aria-label={t('Load impedance (drag or use arrow keys)')}
          aria-valuetext={`${fmtNum(zl.re, 4)} ${zl.im < 0 ? '−' : '+'} j${fmtNum(Math.abs(zl.im), 4)} Ω`}
          onPointerDown={onDown('load')}
          onKeyDown={key}
        >
          <circle cx={f4(g.re)} cy={f4(-g.im)} r={rad(22)} fill="transparent" />
          <circle cx={f4(g.re)} cy={f4(-g.im)} r={rad(8)} className="load-dot" strokeWidth={sw(2.5)} />
          <text x={f4(g.re) + rad(12)} y={f4(-g.im) - rad(10)} fontSize={rad(12)} className="load-text" pointerEvents="none">
            {t('Load')}
          </text>
        </g>
      </svg>
      <div className="readout" aria-live="off">
        <span className="ro-label">{hover ? t('Cursor') : t('Load')}</span>
        <span>
          Z = {fmtZ(zShown.re, zShown.im)} Ω
        </span>
        <span>
          Y = {fmtNum(yShown.re * 1000, 3)} {yShown.im < 0 ? '−' : '+'} j{fmtNum(Math.abs(yShown.im) * 1000, 3)} mS
        </span>
        <span>
          Γ = {fmtNum(mag, 3)} ∠ {fmtNum(rad2deg(arg(shown)), 4)}°
        </span>
        <span>{t('VSWR')} = {fmtNum(vswrFromGamma(mag), 3)}</span>
        <span>
          {t('RL')} = {fmtNum(returnLossDb(mag), 3)} dB
        </span>
      </div>
    </div>
  )
}

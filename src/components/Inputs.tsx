import NumberField from './NumberField'
import { abs, arg, c, polar, type C } from '../lib/complex'
import type { AppState, LoadMode } from '../lib/model'
import { gammaMagFromReturnLoss, gammaToZ, rad2deg, returnLossDb, deg2rad, zToGamma } from '../lib/rf'
import type { T } from '../i18n'

interface Props {
  s: AppState
  t: T
  onChange: (patch: Partial<AppState>) => void
  onReset: () => void
}

const clampMag = (m: number) => Math.min(Math.max(m, 0), 0.9999)

export default function Inputs({ s, t, onChange, onReset }: Props) {
  const { zl, z0 } = s
  const g = zToGamma(zl, z0)
  const mag = abs(g)
  const ang = mag < 1e-12 ? 0 : rad2deg(arg(g))
  const setGamma = (m: number, a: number) => onChange({ zl: roundZ(gammaToZ(polar(clampMag(m), deg2rad(a)), z0)) })
  const mode: LoadMode = s.loadMode
  return (
    <div className="panel">
      <section className="section">
        <h3>{t('Load')}</h3>
        <div className="field">
          <label htmlFor="load-mode">{t('Enter as')}</label>
          <select id="load-mode" value={mode} onChange={(e) => onChange({ loadMode: e.target.value as LoadMode })}>
            <option value="z">{t('Impedance Z = R + jX')}</option>
            <option value="gamma">{t('Reflection coefficient Γ')}</option>
            <option value="rl">{t('Return loss + phase')}</option>
          </select>
        </div>
        {mode === 'z' && (
          <div className="grid2">
            <NumberField label={t('R (Ω)')} value={zl.re} min={0} onCommit={(v) => onChange({ zl: c(v, zl.im) })} />
            <NumberField label={t('X (Ω)')} value={zl.im} onCommit={(v) => onChange({ zl: c(zl.re, v) })} />
          </div>
        )}
        {mode === 'gamma' && (
          <div className="grid2">
            <NumberField label={t('|Γ|')} value={Number(mag.toPrecision(5))} min={0} max={0.9999} onCommit={(v) => setGamma(v, ang)} />
            <NumberField label={t('∠Γ (degrees)')} value={Number(ang.toPrecision(5))} onCommit={(v) => setGamma(mag, v)} />
          </div>
        )}
        {mode === 'rl' && (
          <div className="grid2">
            <NumberField label={t('Return loss (dB)')} value={Number(Math.min(returnLossDb(mag), 200).toPrecision(5))} min={0.001} onCommit={(v) => setGamma(gammaMagFromReturnLoss(v), ang)} />
            <NumberField label={t('∠Γ (degrees)')} value={Number(ang.toPrecision(5))} onCommit={(v) => setGamma(mag, v)} />
          </div>
        )}
        <p className="hint">{t('You can also drag the load point on the chart.')}</p>
      </section>
      <section className="section">
        <h3>{t('System')}</h3>
        <div className="grid2">
          <NumberField label={t('Z0 (Ω)')} value={z0} min={0.1} max={10000} onCommit={(v) => onChange({ z0: v })} />
          <div className="field">
            <label>{t('Presets')}</label>
            <div className="row" style={{ marginBottom: 0 }}>
              {[50, 75, 300].map((p) => (
                <button key={p} className="small" onClick={() => onChange({ z0: p })} aria-pressed={z0 === p}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid2">
          <NumberField label={t('Frequency')} value={Number((s.freq / s.freqUnit).toPrecision(8))} min={1e-6} onCommit={(v) => onChange({ freq: v * s.freqUnit })} />
          <div className="field">
            <label htmlFor="funit">{t('Unit')}</label>
            <select id="funit" value={s.freqUnit} onChange={(e) => onChange({ freqUnit: Number(e.target.value) })}>
              <option value={1e3}>kHz</option>
              <option value={1e6}>MHz</option>
              <option value={1e9}>GHz</option>
            </select>
          </div>
        </div>
      </section>
      <section className="section">
        <h3>{t('Options')}</h3>
        <div className="grid2">
          <NumberField label={t('Q for π / T')} value={s.q} min={0} max={1000} onCommit={(v) => onChange({ q: v })} />
          <NumberField label={t('Velocity factor')} value={s.vf} min={0.01} max={1} onCommit={(v) => onChange({ vf: v })} />
          <NumberField label={t('Sweep ± (%)')} value={s.span} min={1} max={95} onCommit={(v) => onChange({ span: v })} />
          <div className="field">
            <label htmlFor="eser">{t('Rounded parts in plot')}</label>
            <select id="eser" value={s.eSel} onChange={(e) => onChange({ eSel: e.target.value as AppState['eSel'] })}>
              <option value="off">{t('Off')}</option>
              <option value="E12">E12</option>
              <option value="E24">E24</option>
            </select>
          </div>
        </div>
        <button className="small" onClick={onReset}>
          {t('Reset all settings')}
        </button>
      </section>
    </div>
  )
}

function roundZ(z: C): C {
  return c(Number(z.re.toPrecision(5)), Number(z.im.toPrecision(5)))
}

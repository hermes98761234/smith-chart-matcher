import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULTS, bestScale, loadState, saveState, type AppState, type ManualEl } from './lib/model'
import { tr, type T } from './i18n'
import { abs, arg, c } from './lib/complex'
import { roundElements } from './lib/eseries'
import { fmtNum, fmtSI, fmtZ } from './lib/format'
import { allSolutions, minPiTQ, type Solution } from './lib/matching'
import { inputImpedance, sweep, trajectory, vswrBand, type Element } from './lib/network'
import { mismatchLossDb, rad2deg, returnLossDb, vswrFromGamma, zToGamma } from './lib/rf'
import Inputs from './components/Inputs'
import ManualEditor from './components/ManualEditor'
import ResponseChart from './components/ResponseChart'
import SmithChart from './components/SmithChart'
import SolutionList, { type SolutionView } from './components/SolutionList'

const REPO = 'https://github.com/hermes98761234/smith-chart-matcher'

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const nextId = useRef(state.nextId)
  const { lang, theme, z0, freq: f0, tab } = state
  const t: T = (s, ...a) => tr(lang, s, ...a)
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }))

  useEffect(() => saveState({ ...state, nextId: nextId.current }), [state])
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = theme
    root.lang = lang
  }, [theme, lang])

  const zl = useMemo(() => c(Math.max(state.zl.re, 1e-6), state.zl.im), [state.zl])
  const matched = abs(zToGamma(zl, z0)) < 1e-6

  const items: SolutionView[] = useMemo(
    () => allSolutions(zl, z0, f0, state.q).map((sol) => ({ sol, band: vswrBand(zl, sol.elements, f0, z0) })),
    [zl, z0, f0, state.q],
  )
  const qmin = useMemo(() => ({ Pi: minPiTQ(zl, z0, 'Pi'), T: minPiTQ(zl, z0, 'T') }), [zl, z0])
  const sel = items.find((i) => i.sol.id === state.selected) ?? items[0]

  const elements: Element[] = useMemo(() => (tab === 'auto' ? (sel?.sol.elements ?? []) : state.manual.map((m) => m.el)), [tab, sel, state.manual])
  const segments = useMemo(() => trajectory(zl, elements, f0, z0), [zl, elements, f0, z0])
  const zin = useMemo(() => inputImpedance(zl, elements, f0, f0), [zl, elements, f0])
  const gin = zToGamma(zin, z0)

  const fLo = f0 * (1 - state.span / 100)
  const fHi = f0 * (1 + state.span / 100)
  const ideal = useMemo(() => sweep(zl, elements, f0, z0, fLo, fHi), [zl, elements, f0, z0, fLo, fHi])
  const hasLumped = elements.some((e) => e.type === 'L' || e.type === 'C' || e.type === 'R')
  const rounded = useMemo(
    () => (state.eSel !== 'off' && hasLumped ? sweep(zl, roundElements(elements, state.eSel), f0, z0, fLo, fHi) : null),
    [zl, elements, f0, z0, fLo, fHi, state.eSel, hasLumped],
  )
  const bare = useMemo(() => (elements.length > 0 ? sweep(zl, [], f0, z0, fLo, fHi) : null), [zl, elements, f0, z0, fLo, fHi])

  const editInManual = (sol: Solution) => {
    const manual: ManualEl[] = sol.elements.map((el) => ({
      id: nextId.current++,
      el,
      scale: el.type === 'L' || el.type === 'C' || el.type === 'R' ? bestScale(el.type, el.value) : 1,
    }))
    update({ manual, tab: 'manual' })
  }

  const mag = abs(gin) < 1e-9 ? 0 : abs(gin)
  const ok = mag < 0.05

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Smith chart matcher')}</span>
        <span className="hint">{t('Design impedance-matching networks on a Smith chart.')}</span>
        <span className="spacer" />
        <label className="inline-label">
          {t('Language')}
          <select value={lang} onChange={(e) => update({ lang: e.target.value as AppState['lang'] })}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label className="inline-label">
          {t('Theme')}
          <select value={theme} onChange={(e) => update({ theme: e.target.value as AppState['theme'] })}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>
      <div className="body">
        <aside className="side">
          <Inputs
            s={state}
            t={t}
            onChange={update}
            onReset={() => {
              nextId.current = 1
              setState({ ...DEFAULTS, lang, theme })
            }}
          />
        </aside>
        <main className="main">
          <div className="top">
            <SmithChart
              zl={zl}
              z0={z0}
              segments={segments}
              end={gin}
              showZ={state.showZ}
              showY={state.showY}
              showVswr={state.showVswr}
              onShow={(k, v) => update({ [k]: v })}
              onLoad={(z) => update({ zl: z })}
              t={t}
            />
            <div className="results">
              <div className="box summary">
                <h3>{t('Result at the design frequency')}</h3>
                <p className={`verdict ${ok ? 'ok' : mag < 0.33 ? 'warn' : 'err'}`}>
                  {elements.length === 0 && !matched
                    ? t('No network applied: VSWR {0}', fmtNum(vswrFromGamma(mag), 3))
                    : ok
                      ? t('Matched: VSWR {0}', fmtNum(vswrFromGamma(mag), 3))
                      : t('Not matched: VSWR {0}', fmtNum(vswrFromGamma(mag), 3))}
                </p>
                <dl className="kv">
                  <dt>{t('Input impedance')}</dt>
                  <dd>
                    {fmtZ(zin.re, zin.im)} Ω
                  </dd>
                  <dt>Γ</dt>
                  <dd>
                    {fmtNum(mag, 3)}{mag > 0 && ` ∠ ${fmtNum(rad2deg(arg(gin)), 4)}°`}
                  </dd>
                  <dt>{t('Return loss')}</dt>
                  <dd>{returnLossDb(mag) > 100 ? '> 100 dB' : `${fmtNum(returnLossDb(mag), 3)} dB`}</dd>
                  <dt>{t('Mismatch loss')}</dt>
                  <dd>{fmtNum(mismatchLossDb(mag), 3)} dB</dd>
                  <dt>{t('Frequency')}</dt>
                  <dd>{fmtSI(f0, 'Hz', 6)}</dd>
                </dl>
              </div>
              <div className="box">
                <div className="tabs" role="tablist">
                  <button role="tab" aria-selected={tab === 'auto'} className={tab === 'auto' ? 'on' : ''} onClick={() => update({ tab: 'auto' })}>
                    {t('Matching solutions')}
                  </button>
                  <button role="tab" aria-selected={tab === 'manual'} className={tab === 'manual' ? 'on' : ''} onClick={() => update({ tab: 'manual' })}>
                    {t('Manual')} {state.manual.length > 0 && <span className="count">{state.manual.length}</span>}
                  </button>
                </div>
                {tab === 'auto' ? (
                  <SolutionList
                    items={items}
                    selected={sel?.sol.id ?? ''}
                    onSelect={(id) => update({ selected: id })}
                    onEdit={editInManual}
                    f0={f0}
                    vf={state.vf}
                    q={state.q}
                    qmin={qmin}
                    matched={matched}
                    t={t}
                  />
                ) : (
                  <ManualEditor items={state.manual} f0={f0} z0={z0} vf={state.vf} t={t} nextId={() => nextId.current++} onChange={(manual) => update({ manual })} />
                )}
              </div>
            </div>
          </div>
          <ResponseChart ideal={ideal} rounded={rounded} roundedLabel={t('Nearest {0} parts', state.eSel)} bare={bare} f0={f0} t={t} />
        </main>
      </div>
      <p className="hint foot">
        {t('Ideal, lossless elements; the load is held constant over the sweep. Lines scale with frequency.')} <a href={REPO}>{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}

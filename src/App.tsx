import { useEffect, useMemo, useState } from 'react'
import { compute, summary, type Inputs, type Model } from './lib/budget'
import { DEFAULTS, PRESETS } from './lib/presets'
import { invalidFields, loadState, saveState, type AppState } from './lib/model'
import { dbmToPower, fix, fmt, kmToDist, wavelengthM, type BwUnit, type DistUnit, type FreqUnit, type PowerUnit } from './lib/units'
import type { Env } from './lib/propagation'
import type { Polarization } from './lib/rain'
import { tr, type T } from './i18n'
import NumberField from './components/NumberField'
import { RangeChart, Waterfall } from './components/Charts'

const REPO = 'https://github.com/hermes98761234/link-budget-calculator'

const MODELS: { id: Model; label: string }[] = [
  { id: 'fspl', label: 'Free space (Friis)' },
  { id: 'tworay', label: 'Two-ray ground' },
  { id: 'hata', label: 'Okumura–Hata (150–1500 MHz)' },
  { id: 'cost231', label: 'COST-231 Hata (1.5–2 GHz)' },
]
const ENVS: { id: Env; label: string }[] = [
  { id: 'metro', label: 'Large city / metropolitan' },
  { id: 'urban', label: 'Urban (small/medium city)' },
  { id: 'suburban', label: 'Suburban' },
  { id: 'open', label: 'Open / rural' },
]
const POLS: { id: Polarization; label: string }[] = [
  { id: 'H', label: 'Horizontal' },
  { id: 'V', label: 'Vertical' },
  { id: 'C', label: 'Circular' },
]
const RAIN_PRESETS = [
  { v: 0, label: 'None' },
  { v: 5, label: 'Light (5 mm/h)' },
  { v: 25, label: 'Moderate (25 mm/h)' },
  { v: 50, label: 'Heavy (50 mm/h)' },
  { v: 100, label: 'Tropical (100 mm/h)' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [copied, setCopied] = useState(false)
  const { inputs: inp, settings } = state
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const bad = useMemo(() => invalidFields(inp), [inp])
  const valid = bad.size === 0
  const r = useMemo(() => (valid ? compute(inp) : null), [inp, valid])

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setState((s) => ({ ...s, inputs: { ...s.inputs, [k]: v }, preset: 'custom' }))
  const num = (k: keyof Inputs) => (v: number) => set(k, v as never)

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
  }, [settings.theme, settings.lang])

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    setState((s) => ({ ...s, inputs: { ...DEFAULTS, ...p.patch }, preset: id }))
  }
  const copy = async () => {
    if (!r) return
    try {
      await navigator.clipboard.writeText(summary(inp, r))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const modelHasEnv = inp.model === 'hata' || inp.model === 'cost231'
  const modelHasHeights = inp.model !== 'fspl'
  const du = inp.distUnit

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Link budget calculator')}</span>
        <span className="hint grow">{t('Friis path loss, propagation models, rain fade and range for any radio link.')}</span>
        <label className="inline-label">
          {t('Language')}
          <select value={settings.lang} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, lang: e.target.value as 'en' | 'uk' } }))}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label className="inline-label">
          {t('Theme')}
          <select value={settings.theme} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, theme: e.target.value as 'auto' | 'light' | 'dark' } }))}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <Section title={t('Preset')}>
              <div className="field">
                <select aria-label={t('Preset')} value={state.preset} onChange={(e) => applyPreset(e.target.value)}>
                  {state.preset === 'custom' && <option value="custom">{t('Custom')}</option>}
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{t(p.name)}</option>
                  ))}
                </select>
              </div>
            </Section>

            <Section title={t('Link')}>
              <div className="grid2">
                <NumberField label={t('Frequency')} value={inp.freq} bad={bad.has('freq')} onChange={num('freq')}
                  unit={{ value: inp.freqUnit, options: ['MHz', 'GHz'], onChange: (u) => set('freqUnit', u as FreqUnit) }} />
                <NumberField label={t('Distance')} value={inp.dist} bad={bad.has('dist')} onChange={num('dist')}
                  unit={{ value: du, options: ['km', 'mi', 'm'], onChange: (u) => set('distUnit', u as DistUnit) }} />
              </div>
              <div className="field">
                <label htmlFor="model">{t('Path loss model')}</label>
                <select id="model" value={inp.model} onChange={(e) => set('model', e.target.value as Model)}>
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{t(m.label)}</option>
                  ))}
                </select>
              </div>
              {modelHasEnv && (
                <div className="field">
                  <label htmlFor="env">{t('Environment')}</label>
                  <select id="env" value={inp.env} onChange={(e) => set('env', e.target.value as Env)}>
                    {ENVS.map((m) => (
                      <option key={m.id} value={m.id}>{t(m.label)}</option>
                    ))}
                  </select>
                </div>
              )}
              {modelHasHeights && (
                <div className="grid2">
                  <NumberField label={t('Tx antenna height')} suffix="m" value={inp.hTx} bad={bad.has('hTx')} onChange={num('hTx')} />
                  <NumberField label={t('Rx antenna height')} suffix="m" value={inp.hRx} bad={bad.has('hRx')} onChange={num('hRx')} />
                </div>
              )}
            </Section>

            <Section title={t('Transmitter')}>
              <NumberField label={t('Tx power')} value={inp.txPower} bad={bad.has('txPower')} onChange={num('txPower')}
                unit={{ value: inp.txPowerUnit, options: ['dBm', 'dBW', 'mW', 'W'], onChange: (u) => set('txPowerUnit', u as PowerUnit) }} />
              <div className="grid3">
                <NumberField label={t('Cable loss')} suffix="dB" value={inp.txCable} onChange={num('txCable')} />
                <NumberField label={t('Connectors')} suffix="dB" value={inp.txConn} onChange={num('txConn')} />
                <NumberField label={t('Antenna gain')} suffix="dBi" value={inp.txGain} onChange={num('txGain')} />
              </div>
            </Section>

            <Section title={t('Receiver')}>
              <div className="grid3">
                <NumberField label={t('Antenna gain')} suffix="dBi" value={inp.rxGain} onChange={num('rxGain')} />
                <NumberField label={t('Cable loss')} suffix="dB" value={inp.rxCable} onChange={num('rxCable')} />
                <NumberField label={t('Connectors')} suffix="dB" value={inp.rxConn} onChange={num('rxConn')} />
              </div>
              <div className="grid2">
                <NumberField label={t('Bandwidth')} value={inp.bw} bad={bad.has('bw')} onChange={num('bw')}
                  unit={{ value: inp.bwUnit, options: ['Hz', 'kHz', 'MHz'], onChange: (u) => set('bwUnit', u as BwUnit) }} />
                <NumberField label={t('Noise figure')} suffix="dB" value={inp.nf} onChange={num('nf')} />
              </div>
              <div className="field">
                <label htmlFor="sens">{t('Sensitivity')}</label>
                <select id="sens" value={inp.sensMode} onChange={(e) => set('sensMode', e.target.value as 'computed' | 'manual')}>
                  <option value="computed">{t('From noise figure, bandwidth and SNR')}</option>
                  <option value="manual">{t('Enter manually (from datasheet)')}</option>
                </select>
              </div>
              {inp.sensMode === 'computed' ? (
                <NumberField label={t('Required SNR')} suffix="dB" value={inp.snr} onChange={num('snr')} />
              ) : (
                <NumberField label={t('Receiver sensitivity')} suffix="dBm" value={inp.sensManual} onChange={num('sensManual')} />
              )}
            </Section>

            <Section title={t('Extra losses and margin')}>
              <div className="grid3">
                <NumberField label={t('Polarization mismatch')} suffix="dB" value={inp.polLoss} onChange={num('polLoss')} />
                <NumberField label={t('Atmosphere / other')} suffix="dB" value={inp.atmLoss} onChange={num('atmLoss')} />
                <NumberField label={t('Obstruction / foliage')} suffix="dB" value={inp.obstLoss} onChange={num('obstLoss')} />
              </div>
              <div className="grid2">
                <NumberField label={t('Rain rate (0.01%)')} suffix="mm/h" value={inp.rainRate} onChange={num('rainRate')}
                  title={t('Rain rate exceeded 0.01% of the year (ITU-R P.837). 0 disables rain loss.')} />
                <div className="field">
                  <label htmlFor="pol">{t('Polarization')}</label>
                  <select id="pol" value={inp.pol} onChange={(e) => set('pol', e.target.value as Polarization)}>
                    {POLS.map((m) => (
                      <option key={m.id} value={m.id}>{t(m.label)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                {RAIN_PRESETS.map((p) => (
                  <button key={p.v} type="button" className={'small' + (inp.rainRate === p.v ? ' on' : '')} onClick={() => set('rainRate', p.v)}>
                    {t(p.label)}
                  </button>
                ))}
              </div>
              <NumberField label={t('Required fade margin')} suffix="dB" value={inp.fadeMargin} onChange={num('fadeMargin')}
                title={t('Margin above sensitivity you want to keep for fading and uncertainty.')} />
            </Section>
          </div>
        </aside>

        <main className="main">
          {!r ? (
            <div className="box"><p className="verdict err">{t('Fix the highlighted fields.')}</p></div>
          ) : (
            <>
              <div className="box">
                <p className={'verdict ' + (r.ok ? 'ok' : r.linkMargin >= 0 ? 'warn' : 'err')}>
                  {r.ok
                    ? t('Link closes: {0} dB margin ({1} dB above the required fade margin).', fix(r.linkMargin, 1), fix(r.excess, 1))
                    : r.linkMargin >= 0
                      ? t('Marginal: {0} dB margin, {1} dB short of the required fade margin.', fix(r.linkMargin, 1), fix(-r.excess, 1))
                      : t('Link fails: received power is {0} dB below sensitivity.', fix(-r.linkMargin, 1))}
                </p>
                {r.warnings.map((w) => (
                  <p key={w.msg} className="hint warn-text">{t(w.msg, ...w.args)}</p>
                ))}
                <div className="cards">
                  <Stat label={t('EIRP')} value={`${fix(r.eirpDbm, 1)} dBm`} sub={`${fmt(dbmToPower(r.eirpDbm, 'W'), 3)} W`} />
                  <Stat label={t('Path loss')} value={`${fix(r.pathLoss, 1)} dB`} sub={r.rain > 0 ? t('+ {0} dB rain', fix(r.rain, 1)) : undefined} />
                  <Stat label={t('Received power')} value={`${fix(r.prxDbm, 1)} dBm`} sub={`${fmt(dbmToPower(r.prxDbm, 'W'), 3)} W`} />
                  <Stat label={t('Sensitivity')} value={`${fix(r.sensitivityDbm, 1)} dBm`} sub={t('noise floor {0} dBm', fix(r.noiseFloorDbm, 1))} />
                  <Stat label={t('Link margin')} value={`${fix(r.linkMargin, 1)} dB`} sub={t('Rx SNR {0} dB', fix(r.rxSnr, 1))} tone={r.ok ? 'ok' : r.linkMargin >= 0 ? 'warn' : 'err'} />
                  <Stat
                    label={t('Max range')}
                    value={r.maxRangeKm === 0 ? t('none') : Number.isFinite(r.maxRangeKm) ? `${fmt(kmToDist(r.maxRangeKm, du), 3)} ${du}` : t('unbounded')}
                    sub={t('with {0} dB fade margin', inp.fadeMargin)}
                  />
                  <Stat label={t('Wavelength')} value={`${fmt(wavelengthM(r.fMHz), 3)} m`} sub={`${fmt(r.fMHz, 5)} MHz`} />
                </div>
                <div className="row">
                  <button type="button" onClick={copy}>{copied ? t('Copied') : t('Copy summary')}</button>
                </div>
              </div>

              <div className="box">
                <h3>{t('Gain and loss waterfall')}</h3>
                <Waterfall r={r} inp={inp} t={t} />
                <div className="legend">
                  <span><i className="sw gain" />{t('Gain')}</span>
                  <span><i className="sw loss" />{t('Loss')}</span>
                  <span><i className="sw total" />{t('Level')}</span>
                  <span><i className="sw sens" />{t('Sensitivity')}</span>
                  {inp.fadeMargin > 0 && <span><i className="sw req" />{t('Required level')}</span>}
                </div>
              </div>

              <div className="box">
                <h3>{t('Received power versus distance')}</h3>
                <RangeChart r={r} inp={inp} t={t} />
              </div>

              <div className="box">
                <h3>{t('Budget table')}</h3>
                <table className="data">
                  <tbody>
                    {r.steps.map((s, i) => (
                      <tr key={i} className={s.kind === 'total' ? 'total' : undefined}>
                        <td>{t(s.label)}</td>
                        <td className="num">{s.kind === 'start' || s.kind === 'total' ? `${fix(s.value, 2)} dBm` : `${s.value > 0 ? '+' : ''}${fix(s.value, 2)} dB`}</td>
                        <td className="num muted">{s.kind === 'start' || s.kind === 'total' ? '' : `${fix(s.level, 2)} dBm`}</td>
                      </tr>
                    ))}
                    <tr><td>{t('Sensitivity')}</td><td className="num">{fix(r.sensitivityDbm, 2)} dBm</td><td /></tr>
                    <tr className="total"><td>{t('Link margin')}</td><td className="num">{fix(r.linkMargin, 2)} dB</td><td /></tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
      <p className="hint foot">
        {t('Models give median estimates. Real links need margin for terrain, fading and interference. Everything runs in your browser.')}{' '}
        <a href={REPO}>{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'err' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={'stat-value' + (tone ? ' ' + tone : '')}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

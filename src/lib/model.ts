import type { Inputs } from './budget'
import { DEFAULTS } from './presets'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export interface Settings {
  lang: Lang
  theme: Theme
}
export interface AppState {
  inputs: Inputs
  settings: Settings
  preset: string
}

const KEY = 'link-budget-calculator:v1'

export function defaultLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en'
}

export const defaultState = (): AppState => ({
  inputs: { ...DEFAULTS },
  settings: { lang: defaultLang(), theme: 'auto' },
  preset: 'ptp58',
})

/** Keeps only stored values whose type matches the default, so stale data cannot break the app. */
export function sanitize(raw: unknown): AppState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AppState>
  const inputs: Record<string, unknown> = { ...base.inputs }
  const stored = (r.inputs ?? {}) as Record<string, unknown>
  for (const k of Object.keys(base.inputs)) {
    const d = (base.inputs as unknown as Record<string, unknown>)[k]
    const v = stored[k]
    if (typeof d === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeof v === 'string') inputs[k] = v
  }
  const s = (r.settings ?? {}) as Partial<Settings>
  return {
    inputs: inputs as unknown as Inputs,
    settings: {
      lang: s.lang === 'uk' || s.lang === 'en' ? s.lang : base.settings.lang,
      theme: s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto' ? s.theme : 'auto',
    },
    preset: typeof r.preset === 'string' ? r.preset : base.preset,
  }
}

export function loadState(): AppState {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return defaultState()
  }
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

/** Fields that must be positive finite numbers. */
export function invalidFields(i: Inputs): Set<keyof Inputs> {
  const bad = new Set<keyof Inputs>()
  for (const k of ['freq', 'dist', 'bw', 'hTx', 'hRx'] as const) if (!(i[k] > 0)) bad.add(k)
  if (!(i.txPower > 0) && (i.txPowerUnit === 'mW' || i.txPowerUnit === 'W')) bad.add('txPower')
  return bad
}

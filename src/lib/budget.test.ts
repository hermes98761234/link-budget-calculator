import { describe, expect, it } from 'vitest'
import { compute, maxRange, noiseFloor, pathLossAt, prxAt, sensitivity, validate, type Inputs } from './budget'
import { DEFAULTS, PRESETS } from './presets'
import { dbmToPower, fmt, powerToDbm } from './units'
import { defaultState, invalidFields, sanitize } from './model'

const base: Inputs = {
  ...DEFAULTS, freq: 1, freqUnit: 'GHz', dist: 1, distUnit: 'km', model: 'fspl',
  txPower: 30, txPowerUnit: 'dBm', txCable: 0, txConn: 0, txGain: 0, rxGain: 0, rxCable: 0, rxConn: 0,
  polLoss: 0, atmLoss: 0, obstLoss: 0, rainRate: 0, fadeMargin: 0,
}

describe('units', () => {
  it('converts power', () => {
    expect(powerToDbm(1, 'W')).toBeCloseTo(30, 9)
    expect(powerToDbm(1, 'mW')).toBeCloseTo(0, 9)
    expect(powerToDbm(0, 'dBW')).toBeCloseTo(30, 9)
    expect(dbmToPower(36.0206, 'W')).toBeCloseTo(4, 3)
    expect(dbmToPower(powerToDbm(250, 'mW'), 'mW')).toBeCloseTo(250, 9)
  })
  it('formats', () => {
    expect(fmt(1234.5678)).toBe('1230')
    expect(fmt(0.0123456)).toBe('0.0123')
    expect(fmt(Infinity)).toBe('∞')
  })
})

describe('receiver sensitivity', () => {
  it('is -174 + 10 log B + NF + SNR', () => {
    const i = { ...base, bw: 1, bwUnit: 'MHz' as const, nf: 5, snr: 10 }
    expect(noiseFloor(i)).toBeCloseTo(-109, 6)
    expect(sensitivity(i)).toBeCloseTo(-99, 6)
  })
  it('LoRa SF12 125 kHz is about -137 dBm', () => {
    const lora = PRESETS.find((p) => p.id === 'lora')!
    expect(sensitivity({ ...base, ...lora.patch })).toBeCloseTo(-174 + 50.97 + 6 - 20, 1)
  })
  it('manual override wins', () => {
    expect(sensitivity({ ...base, sensMode: 'manual', sensManual: -85 })).toBe(-85)
  })
})

describe('link budget', () => {
  it('Friis: Prx = Pt + Gt + Gr - FSPL', () => {
    const i = { ...base, txGain: 10, rxGain: 5, txCable: 2, rxConn: 1 }
    const r = compute(i)
    expect(r.pathLoss).toBeCloseTo(92.44, 2)
    expect(r.eirpDbm).toBeCloseTo(38, 9)
    expect(r.prxDbm).toBeCloseTo(30 + 10 + 5 - 2 - 1 - 92.44, 2)
  })
  it('link margin and verdict follow sensitivity and required fade margin', () => {
    const i = { ...base, sensMode: 'manual' as const, sensManual: -70, fadeMargin: 10 }
    const r = compute(i)
    expect(r.prxDbm).toBeCloseTo(-62.44, 2)
    expect(r.linkMargin).toBeCloseTo(7.56, 2)
    expect(r.excess).toBeCloseTo(-2.44, 2)
    expect(r.ok).toBe(false)
    expect(compute({ ...i, fadeMargin: 5 }).ok).toBe(true)
  })
  it('waterfall levels chain from Tx power to received power', () => {
    const i = { ...base, txCable: 1, txGain: 12, rxGain: 12, rxCable: 1, obstLoss: 3, rainRate: 25, freq: 10, dist: 5 }
    const r = compute(i)
    expect(r.steps[0].kind).toBe('start')
    expect(r.steps.at(-1)!.level).toBeCloseTo(r.prxDbm, 9)
    let lvl = r.steps[0].level
    for (const s of r.steps.slice(1)) {
      if (s.kind === 'total') expect(s.value).toBeCloseTo(lvl, 9)
      else lvl += s.value
    }
    expect(lvl).toBeCloseTo(r.prxDbm, 9)
    expect(r.rain).toBeGreaterThan(0)
  })
  it('rain adds loss only on top of the path loss', () => {
    const dry = prxAt({ ...base, freq: 10 }, 5)
    const wet = prxAt({ ...base, freq: 10, rainRate: 25 }, 5)
    expect(dry - wet).toBeCloseTo(0.696 * (5 / (1 + 5 / (35 * Math.exp(-0.375)))), 2)
  })
  it('Hata never reports less than free space', () => {
    const i = { ...base, model: 'hata' as const, freq: 900, freqUnit: 'MHz' as const, hTx: 50, hRx: 1.5, env: 'open' as const }
    expect(pathLossAt(i, 0.01)).toBeGreaterThanOrEqual(pathLossAt({ ...i, model: 'fspl' }, 0.01))
  })
})

describe('max range solver', () => {
  it('inverts free-space loss exactly', () => {
    const i = { ...base, sensMode: 'manual' as const, sensManual: -90, fadeMargin: 10 }
    // allowed loss = 30 - (-90) - 10 = 110 dB -> d = 10^((110-92.44-... )/20) km at 1 GHz
    const expected = Math.pow(10, (110 - 32.44 - 60) / 20)
    expect(maxRange(i)).toBeCloseTo(expected, 4)
  })
  it('margin at the max range equals the required fade margin', () => {
    for (const p of PRESETS) {
      const i = { ...DEFAULTS, ...p.patch }
      const d = maxRange(i)
      if (d > 0 && Number.isFinite(d)) {
        expect(prxAt(i, d) - sensitivity(i)).toBeCloseTo(i.fadeMargin, 4)
      }
    }
  })
  it('with rain the range is shorter', () => {
    const i = { ...DEFAULTS, rainRate: 0 }
    expect(maxRange({ ...i, rainRate: 50 })).toBeLessThan(maxRange(i))
  })
  it('returns 0 when hopeless and Infinity when unbounded', () => {
    expect(maxRange({ ...base, txPower: -100, txPowerUnit: 'dBm' })).toBe(0)
    expect(maxRange({ ...base, txPower: 200, sensMode: 'manual', sensManual: -300 })).toBe(Infinity)
  })
})

describe('validation and state', () => {
  it('warns outside model ranges', () => {
    const w = validate({ ...base, model: 'hata', freq: 2000, freqUnit: 'MHz' })
    expect(w.some((x) => x.msg.startsWith('Hata is valid for 150'))).toBe(true)
    expect(validate({ ...base, model: 'fspl' })).toHaveLength(0)
  })
  it('every preset computes finite values', () => {
    for (const p of PRESETS) {
      const r = compute({ ...DEFAULTS, ...p.patch })
      expect(Number.isFinite(r.prxDbm)).toBe(true)
      expect(Number.isFinite(r.sensitivityDbm)).toBe(true)
    }
  })
  it('sanitizes stored state', () => {
    const s = sanitize({ inputs: { freq: 'x', dist: 42, model: 'hata' }, settings: { lang: 'zz', theme: 'dark' } })
    expect(s.inputs.freq).toBe(DEFAULTS.freq)
    expect(s.inputs.dist).toBe(42)
    expect(s.inputs.model).toBe('hata')
    expect(s.settings.theme).toBe('dark')
    expect(sanitize(null).inputs).toEqual(defaultState().inputs)
  })
  it('flags non-positive fields', () => {
    expect(invalidFields({ ...DEFAULTS, freq: 0 }).has('freq')).toBe(true)
    expect(invalidFields(DEFAULTS).size).toBe(0)
  })
})

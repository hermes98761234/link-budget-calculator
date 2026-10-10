import { cost231, fspl, hata, twoRay, type Env } from './propagation'
import { rainLoss, type Polarization } from './rain'
import {
  THERMAL_NOISE_DBM_HZ, bwToHz, dbmToWatts, distToKm, freqToMHz, powerToDbm,
  type BwUnit, type DistUnit, type FreqUnit, type PowerUnit,
} from './units'

export type Model = 'fspl' | 'tworay' | 'hata' | 'cost231'

/** Everything the user enters, in the units they chose. */
export interface Inputs {
  freq: number
  freqUnit: FreqUnit
  dist: number
  distUnit: DistUnit
  model: Model
  env: Env
  hTx: number // m, base/transmit antenna height
  hRx: number // m, mobile/receive antenna height
  txPower: number
  txPowerUnit: PowerUnit
  txCable: number // dB
  txConn: number // dB
  txGain: number // dBi
  rxGain: number // dBi
  rxCable: number // dB
  rxConn: number // dB
  polLoss: number // dB
  atmLoss: number // dB
  obstLoss: number // dB
  rainRate: number // mm/h, 0 = none
  pol: Polarization
  bw: number
  bwUnit: BwUnit
  nf: number // dB
  snr: number // dB required
  sensMode: 'computed' | 'manual'
  sensManual: number // dBm
  fadeMargin: number // dB required
}

export interface Warning {
  msg: string
  args: (string | number)[]
}

export interface Step {
  /** English label, translated in the UI. */
  label: string
  kind: 'start' | 'gain' | 'loss' | 'total'
  /** Signed change in dB (for start/total: the absolute level in dBm). */
  value: number
  /** Level in dBm after this step. */
  level: number
}

export interface Result {
  fMHz: number
  dKm: number
  txDbm: number
  eirpDbm: number
  pathLoss: number
  rain: number
  other: number
  prxDbm: number
  noiseFloorDbm: number
  sensitivityDbm: number
  linkMargin: number
  /** Margin left after the required fade margin. */
  excess: number
  rxSnr: number
  ok: boolean
  steps: Step[]
  warnings: Warning[]
  /** Maximum range for the required fade margin, km. 0 = not even 1 m; Infinity = beyond the search limit. */
  maxRangeKm: number
}

export const MIN_RANGE_KM = 0.001
export const MAX_RANGE_KM = 1e6

/** Median path loss (dB) of the chosen model at a distance, never below free space. */
export function pathLossAt(inp: Inputs, dKm: number): number {
  const f = freqToMHz(inp.freq, inp.freqUnit)
  const free = fspl(dKm, f)
  switch (inp.model) {
    case 'fspl': return free
    case 'tworay': return twoRay(dKm, f, inp.hTx, inp.hRx)
    case 'hata': return Math.max(free, hata(dKm, f, inp.hTx, inp.hRx, inp.env))
    case 'cost231': return Math.max(free, cost231(dKm, f, inp.hTx, inp.hRx, inp.env))
  }
}

export const otherLosses = (inp: Inputs) => inp.polLoss + inp.atmLoss + inp.obstLoss

/** Net gain from the transmitter output to the receiver input, excluding path loss and rain, dB. */
const fixedGain = (inp: Inputs) =>
  inp.txGain - inp.txCable - inp.txConn + inp.rxGain - inp.rxCable - inp.rxConn - otherLosses(inp)

/** Received power at the receiver input, dBm. */
export function prxAt(inp: Inputs, dKm: number): number {
  const f = freqToMHz(inp.freq, inp.freqUnit)
  const rain = rainLoss(f, dKm, inp.rainRate, inp.pol)
  return powerToDbm(inp.txPower, inp.txPowerUnit) + fixedGain(inp) - pathLossAt(inp, dKm) - rain
}

export const noiseFloor = (inp: Inputs) =>
  THERMAL_NOISE_DBM_HZ + 10 * Math.log10(bwToHz(inp.bw, inp.bwUnit)) + inp.nf

/** Receiver sensitivity: kTB + NF + required SNR, or the manual value. */
export const sensitivity = (inp: Inputs) =>
  inp.sensMode === 'manual' ? inp.sensManual : noiseFloor(inp) + inp.snr

/** Largest distance (km) whose margin still covers the required fade margin. Bisection in log distance. */
export function maxRange(inp: Inputs): number {
  const need = sensitivity(inp) + inp.fadeMargin
  const ok = (d: number) => prxAt(inp, d) >= need
  if (!ok(MIN_RANGE_KM)) return 0
  if (ok(MAX_RANGE_KM)) return Infinity
  let lo = Math.log(MIN_RANGE_KM)
  let hi = Math.log(MAX_RANGE_KM)
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (ok(Math.exp(mid))) lo = mid
    else hi = mid
  }
  return Math.exp(lo)
}

export function validate(inp: Inputs): Warning[] {
  const w: Warning[] = []
  const f = freqToMHz(inp.freq, inp.freqUnit)
  const { model, hTx, hRx } = inp
  const dKm = distToKm(inp.dist, inp.distUnit)
  if (model === 'hata') {
    if (f < 150 || f > 1500) w.push({ msg: 'Hata is valid for 150–1500 MHz (this is {0} MHz).', args: [+f.toFixed(1)] })
    if (hTx < 30 || hTx > 200) w.push({ msg: 'Hata expects a base antenna of 30–200 m.', args: [] })
    if (hRx < 1 || hRx > 10) w.push({ msg: 'Hata expects a mobile antenna of 1–10 m.', args: [] })
    if (dKm < 1 || dKm > 20) w.push({ msg: 'Hata is valid for 1–20 km.', args: [] })
  }
  if (model === 'cost231') {
    if (f < 1500 || f > 2000) w.push({ msg: 'COST-231 is valid for 1500–2000 MHz (this is {0} MHz).', args: [+f.toFixed(1)] })
    if (hTx < 30 || hTx > 200) w.push({ msg: 'COST-231 expects a base antenna of 30–200 m.', args: [] })
    if (hRx < 1 || hRx > 10) w.push({ msg: 'COST-231 expects a mobile antenna of 1–10 m.', args: [] })
    if (dKm < 1 || dKm > 20) w.push({ msg: 'COST-231 is valid for 1–20 km.', args: [] })
  }
  if (inp.rainRate > 0 && f < 1000) w.push({ msg: 'Rain loss is ignored below 1 GHz.', args: [] })
  if (inp.rainRate > 0 && f > 100000) w.push({ msg: 'Rain coefficients are clamped at 100 GHz.', args: [] })
  return w
}

export function compute(inp: Inputs): Result {
  const fMHz = freqToMHz(inp.freq, inp.freqUnit)
  const dKm = distToKm(inp.dist, inp.distUnit)
  const txDbm = powerToDbm(inp.txPower, inp.txPowerUnit)
  const pathLoss = pathLossAt(inp, dKm)
  const rain = rainLoss(fMHz, dKm, inp.rainRate, inp.pol)
  const other = otherLosses(inp)
  const eirpDbm = txDbm - inp.txCable - inp.txConn + inp.txGain
  const prxDbm = prxAt(inp, dKm)
  const noise = noiseFloor(inp)
  const sens = sensitivity(inp)

  const steps: Step[] = []
  let lvl = txDbm
  steps.push({ label: 'Tx power', kind: 'start', value: txDbm, level: lvl })
  const add = (label: string, delta: number) => {
    if (delta === 0) return
    lvl += delta
    steps.push({ label, kind: delta > 0 ? 'gain' : 'loss', value: delta, level: lvl })
  }
  add('Tx cable', -inp.txCable)
  add('Tx connectors', -inp.txConn)
  add('Tx antenna gain', inp.txGain)
  steps.push({ label: 'EIRP', kind: 'total', value: lvl, level: lvl })
  add('Path loss', -pathLoss)
  add('Rain', -rain)
  add('Other losses', -other)
  add('Rx antenna gain', inp.rxGain)
  add('Rx cable', -inp.rxCable)
  add('Rx connectors', -inp.rxConn)
  steps.push({ label: 'Received power', kind: 'total', value: lvl, level: lvl })

  const linkMargin = prxDbm - sens
  return {
    fMHz, dKm, txDbm, eirpDbm, pathLoss, rain, other, prxDbm,
    noiseFloorDbm: noise,
    sensitivityDbm: sens,
    linkMargin,
    excess: linkMargin - inp.fadeMargin,
    rxSnr: prxDbm - noise,
    ok: linkMargin >= inp.fadeMargin,
    steps,
    warnings: validate(inp),
    maxRangeKm: maxRange(inp),
  }
}

/** Plain-text summary for copy/paste. */
export function summary(inp: Inputs, r: Result): string {
  const n = (x: number) => x.toFixed(1)
  return [
    `Link budget: ${inp.freq} ${inp.freqUnit}, ${inp.dist} ${inp.distUnit}, model ${inp.model}`,
    `Tx ${n(r.txDbm)} dBm (${(dbmToWatts(r.txDbm) * 1000).toPrecision(3)} mW), EIRP ${n(r.eirpDbm)} dBm`,
    `Path loss ${n(r.pathLoss)} dB, rain ${n(r.rain)} dB, other ${n(r.other)} dB`,
    `Received ${n(r.prxDbm)} dBm, sensitivity ${n(r.sensitivityDbm)} dBm`,
    `Link margin ${n(r.linkMargin)} dB (required ${inp.fadeMargin} dB): ${r.ok ? 'OK' : 'FAIL'}`,
    `Max range ${Number.isFinite(r.maxRangeKm) ? r.maxRangeKm.toPrecision(3) + ' km' : 'unbounded'}`,
  ].join('\n')
}

export type PowerUnit = 'dBm' | 'dBW' | 'mW' | 'W'
export type FreqUnit = 'MHz' | 'GHz'
export type DistUnit = 'km' | 'mi' | 'm'
export type BwUnit = 'Hz' | 'kHz' | 'MHz'

/** Boltzmann noise density at 290 K, dBm/Hz. */
export const THERMAL_NOISE_DBM_HZ = -174

export const wattsToDbm = (w: number) => 10 * Math.log10(w) + 30
export const dbmToWatts = (dbm: number) => Math.pow(10, (dbm - 30) / 10)

export function powerToDbm(v: number, unit: PowerUnit): number {
  switch (unit) {
    case 'dBm': return v
    case 'dBW': return v + 30
    case 'mW': return 10 * Math.log10(v)
    case 'W': return wattsToDbm(v)
  }
}

export function dbmToPower(dbm: number, unit: PowerUnit): number {
  switch (unit) {
    case 'dBm': return dbm
    case 'dBW': return dbm - 30
    case 'mW': return Math.pow(10, dbm / 10)
    case 'W': return dbmToWatts(dbm)
  }
}

export const freqToMHz = (v: number, u: FreqUnit) => (u === 'GHz' ? v * 1000 : v)
export const bwToHz = (v: number, u: BwUnit) => (u === 'MHz' ? v * 1e6 : u === 'kHz' ? v * 1e3 : v)

const KM_PER: Record<DistUnit, number> = { km: 1, mi: 1.609344, m: 0.001 }
export const distToKm = (v: number, u: DistUnit) => v * KM_PER[u]
export const kmToDist = (km: number, u: DistUnit) => km / KM_PER[u]

export const SPEED_OF_LIGHT = 299792458
export const wavelengthM = (fMHz: number) => SPEED_OF_LIGHT / (fMHz * 1e6)

/** Compact number formatting: significant digits, no exponent for normal magnitudes. */
export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '−∞' : '–'
  if (n === 0) return '0'
  const a = Math.abs(n)
  const s = a >= 1e6 || a < 1e-3 ? n.toExponential(digits - 1) : String(Number(n.toPrecision(digits)))
  return s.replace('-', '−')
}

/** Fixed decimals with a real minus sign. */
export const fix = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('-', '−') : '–')

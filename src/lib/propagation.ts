import { wavelengthM } from './units'

/** Free-space path loss, dB. dKm in km, fMHz in MHz (ITU form: 32.44 + 20 log d + 20 log f). */
export function fspl(dKm: number, fMHz: number): number {
  return 32.44 + 20 * Math.log10(dKm) + 20 * Math.log10(fMHz)
}

/** Distance (m) beyond which the two-ray ground model replaces free space: 4π·ht·hr/λ. */
export function crossoverDistanceM(fMHz: number, ht: number, hr: number): number {
  return (4 * Math.PI * ht * hr) / wavelengthM(fMHz)
}

/**
 * Two-ray ground reflection path loss (dB, antenna gains excluded):
 * 40 log d − 20 log ht − 20 log hr, with free space inside the crossover distance.
 */
export function twoRay(dKm: number, fMHz: number, ht: number, hr: number): number {
  const dM = dKm * 1000
  if (dM <= crossoverDistanceM(fMHz, ht, hr)) return fspl(dKm, fMHz)
  return 40 * Math.log10(dM) - 20 * Math.log10(ht) - 20 * Math.log10(hr)
}

export type Env = 'metro' | 'urban' | 'suburban' | 'open'

/** Mobile antenna height correction a(hm) for small/medium cities, dB. */
function aSmall(fMHz: number, hm: number): number {
  const lf = Math.log10(fMHz)
  return (1.1 * lf - 0.7) * hm - (1.56 * lf - 0.8)
}

/** Mobile antenna height correction for large cities, dB. */
function aLarge(fMHz: number, hm: number): number {
  return fMHz <= 300
    ? 8.29 * Math.pow(Math.log10(1.54 * hm), 2) - 1.1
    : 3.2 * Math.pow(Math.log10(11.75 * hm), 2) - 4.97
}

/** Okumura–Hata path loss, dB. Valid 150–1500 MHz, hb 30–200 m, hm 1–10 m, d 1–20 km. */
export function hata(dKm: number, fMHz: number, hb: number, hm: number, env: Env): number {
  const lf = Math.log10(fMHz)
  const a = env === 'metro' ? aLarge(fMHz, hm) : aSmall(fMHz, hm)
  const urban = 69.55 + 26.16 * lf - 13.82 * Math.log10(hb) - a + (44.9 - 6.55 * Math.log10(hb)) * Math.log10(dKm)
  if (env === 'suburban') return urban - 2 * Math.pow(Math.log10(fMHz / 28), 2) - 5.4
  if (env === 'open') return urban - 4.78 * lf * lf + 18.33 * lf - 40.94
  return urban
}

/** COST-231 Hata extension, dB. Valid 1500–2000 MHz; +3 dB for metropolitan centres. */
export function cost231(dKm: number, fMHz: number, hb: number, hm: number, env: Env): number {
  const cm = env === 'metro' ? 3 : 0
  return (
    46.3 + 33.9 * Math.log10(fMHz) - 13.82 * Math.log10(hb) - aSmall(fMHz, hm) +
    (44.9 - 6.55 * Math.log10(hb)) * Math.log10(dKm) + cm
  )
}

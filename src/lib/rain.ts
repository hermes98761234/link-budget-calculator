export type Polarization = 'H' | 'V' | 'C'

// ITU-R P.838-3 regression coefficients: f (GHz), kH, kV, alphaH, alphaV.
const TABLE: readonly (readonly [number, number, number, number, number])[] = [
  [1, 0.0000259, 0.0000308, 0.9691, 0.8592],
  [2, 0.0000847, 0.0000998, 1.0664, 0.949],
  [4, 0.0001071, 0.0002461, 1.6009, 1.2476],
  [6, 0.0007056, 0.0004878, 1.59, 1.5728],
  [7, 0.001915, 0.001425, 1.481, 1.4745],
  [8, 0.004115, 0.00345, 1.3905, 1.3797],
  [10, 0.01217, 0.01129, 1.2571, 1.2156],
  [12, 0.02386, 0.02455, 1.1825, 1.1216],
  [15, 0.04481, 0.05008, 1.1233, 1.044],
  [20, 0.09164, 0.09611, 1.0568, 0.9847],
  [25, 0.1571, 0.1533, 0.9991, 0.9491],
  [30, 0.2403, 0.2291, 0.9485, 0.9129],
  [35, 0.3374, 0.3224, 0.9047, 0.8761],
  [40, 0.4431, 0.4274, 0.8673, 0.8421],
  [45, 0.5521, 0.5375, 0.8355, 0.8123],
  [50, 0.66, 0.6472, 0.8084, 0.7871],
  [60, 0.8606, 0.8515, 0.7656, 0.7486],
  [70, 1.0315, 1.0253, 0.7345, 0.7215],
  [80, 1.1704, 1.1668, 0.7115, 0.7021],
  [90, 1.2807, 1.2795, 0.6944, 0.6876],
  [100, 1.3671, 1.368, 0.6815, 0.6765],
]

/** Interpolates the table at fGHz: log-log for k, linear in log f for alpha. Clamped to 1–100 GHz. */
function coeffs(fGHz: number) {
  const f = Math.min(100, Math.max(1, fGHz))
  let i = 0
  while (i < TABLE.length - 2 && f > TABLE[i + 1][0]) i++
  const a = TABLE[i]
  const b = TABLE[i + 1]
  const u = (Math.log(f) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]))
  const lerp = (x: number, y: number) => x + (y - x) * u
  const loglerp = (x: number, y: number) => Math.exp(lerp(Math.log(x), Math.log(y)))
  return { kH: loglerp(a[1], b[1]), kV: loglerp(a[2], b[2]), aH: lerp(a[3], b[3]), aV: lerp(a[4], b[4]) }
}

/** Specific rain attenuation γ = k·R^α in dB/km (ITU-R P.838, horizontal path). Zero below 1 GHz. */
export function rainSpecific(fMHz: number, rainRate: number, pol: Polarization): number {
  if (fMHz < 1000 || rainRate <= 0) return 0
  const { kH, kV, aH, aV } = coeffs(fMHz / 1000)
  const c2t = pol === 'H' ? 1 : pol === 'V' ? -1 : 0 // cos(2τ), path elevation 0
  const k = (kH + kV + (kH - kV) * c2t) / 2
  const alpha = (kH * aH + kV * aV + (kH * aH - kV * aV) * c2t) / (2 * k)
  return k * Math.pow(rainRate, alpha)
}

/** Effective path length (km) after ITU-R P.530 distance factor, rain rate capped at 100 mm/h. */
export function rainEffectiveKm(dKm: number, rainRate: number): number {
  const d0 = 35 * Math.exp(-0.015 * Math.min(rainRate, 100))
  return dKm / (1 + dKm / d0)
}

/** Rough rain fade over the path, dB. */
export function rainLoss(fMHz: number, dKm: number, rainRate: number, pol: Polarization): number {
  return rainSpecific(fMHz, rainRate, pol) * rainEffectiveKm(dKm, rainRate)
}

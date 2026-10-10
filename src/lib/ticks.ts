export function niceTicks(min: number, max: number, count = 6): number[] {
  const span = Math.max(max - min, 1e-9)
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number((Math.round(v / step) * step).toPrecision(12)))
  return out
}

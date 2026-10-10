import { prxAt, sensitivity, type Inputs, type Result } from '../lib/budget'
import { distToKm, fix, fmt, kmToDist } from '../lib/units'
import { niceTicks } from '../lib/ticks'
import type { T } from '../i18n'

const W = 760
const H = 340
const M = { l: 52, r: 16, t: 14, b: 62 }

function wrap(s: string): string[] {
  const words = s.split(' ')
  if (words.length < 3) return words.length === 2 ? words : [s]
  const half = Math.ceil(words.length / 2)
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')]
}

export function Waterfall({ r, inp, t }: { r: Result; inp: Inputs; t: T }) {
  const sens = r.sensitivityDbm
  const levels = r.steps.map((s) => s.level)
  const lo = Math.min(...levels, sens) - 8
  const hi = Math.max(...levels, sens + inp.fadeMargin) + 8
  const x0 = M.l
  const x1 = W - M.r - 36
  const y = (v: number) => M.t + ((hi - v) / (hi - lo)) * (H - M.t - M.b)
  const n = r.steps.length
  const slot = (x1 - x0) / n
  const bw = Math.min(slot * 0.66, 56)
  const cx = (i: number) => x0 + slot * (i + 0.5)
  const ticks = niceTicks(lo, hi, 6)
  return (
    <div className="chart-scroll">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Power waterfall from transmitter to receiver')} style={{ minWidth: 620 }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} className="gridline" />
            <text x={x0 - 6} y={y(v) + 3.5} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        <text x={12} y={M.t + 8} className="axis" transform={`rotate(-90 12 ${M.t + 8})`} textAnchor="end">dBm</text>
        {r.steps.map((s, i) => {
          const a = s.kind === 'start' || s.kind === 'total' ? lo : r.steps[i - 1].level
          const b = s.level
          const top = y(Math.max(a, b))
          const h = Math.max(1.5, Math.abs(y(a) - y(b)))
          const cls = s.kind === 'gain' ? 'bar-gain' : s.kind === 'loss' ? 'bar-loss' : 'bar-total'
          const label = s.kind === 'start' || s.kind === 'total' ? fix(s.value, 1) : (s.value > 0 ? '+' : '') + fix(s.value, 1)
          return (
            <g key={i}>
              <rect x={cx(i) - bw / 2} y={top} width={bw} height={h} rx={2} className={cls} />
              <text x={cx(i)} y={top - 4} textAnchor="middle" className="barlabel">{label}</text>
              {wrap(t(s.label)).map((line, k) => (
                <text key={k} x={cx(i)} y={H - M.b + 14 + k * 12} textAnchor="middle" className="axis">{line}</text>
              ))}
            </g>
          )
        })}
        <line x1={x0} x2={x1} y1={y(sens)} y2={y(sens)} className="sens-line" />
        <text x={x1 + 4} y={y(sens) + 4} className="sens-text">{fix(sens, 1)}</text>
        {inp.fadeMargin > 0 && (
          <>
            <line x1={x0} x2={x1} y1={y(sens + inp.fadeMargin)} y2={y(sens + inp.fadeMargin)} className="req-line" />
            <text x={x1 + 4} y={y(sens + inp.fadeMargin) + 4} className="req-text">{fix(sens + inp.fadeMargin, 1)}</text>
          </>
        )}
      </svg>
    </div>
  )
}

export function RangeChart({ r, inp, t }: { r: Result; inp: Inputs; t: T }) {
  const finiteMax = Number.isFinite(r.maxRangeKm) ? r.maxRangeKm : r.dKm
  const dMin = Math.max(0.001, Math.min(r.dKm, finiteMax || r.dKm) / 20)
  const dMax = Math.min(1e6, Math.max(r.dKm, finiteMax) * 5)
  const N = 140
  const ds = Array.from({ length: N + 1 }, (_, i) => dMin * Math.pow(dMax / dMin, i / N))
  const ps = ds.map((d) => prxAt(inp, d))
  const sens = sensitivity(inp)
  const req = sens + inp.fadeMargin
  const lo = Math.min(...ps, sens) - 5
  const hi = Math.max(...ps, req) + 5
  const x0 = M.l
  const x1 = W - M.r
  const yb = H - 40
  const lx = (d: number) => x0 + ((Math.log(d) - Math.log(dMin)) / (Math.log(dMax) - Math.log(dMin))) * (x1 - x0)
  const y = (v: number) => M.t + ((hi - v) / (hi - lo)) * (yb - M.t)
  const path = ds.map((d, i) => `${i ? 'L' : 'M'}${lx(d).toFixed(1)},${y(ps[i]).toFixed(1)}`).join('')
  const shown: number[] = []
  const unit = inp.distUnit
  const uMin = kmToDist(dMin, unit)
  const uMax = kmToDist(dMax, unit)
  const e0 = Math.floor(Math.log10(uMin))
  const e1 = Math.ceil(Math.log10(uMax))
  for (let e = e0; e <= e1; e++) for (const m of e1 - e0 > 4 ? [1] : [1, 2, 5]) {
    const v = m * Math.pow(10, e)
    if (v >= uMin && v <= uMax) shown.push(v)
  }
  const ticks = niceTicks(lo, hi, 6)
  const mark = (km: number, cls: string, label: string, row: number) => (
    <g>
      <line x1={lx(km)} x2={lx(km)} y1={M.t} y2={yb} className={cls} />
      <text x={Math.min(lx(km) + 4, x1 - 4)} y={M.t + 12 + row * 12} textAnchor={lx(km) > x1 - 120 ? 'end' : 'start'} className="axis">{label}</text>
    </g>
  )
  return (
    <div className="chart-scroll">
      <svg className="chart" viewBox={`0 0 ${W} ${H - 20}`} role="img" aria-label={t('Received power versus distance')} style={{ minWidth: 620 }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} className="gridline" />
            <text x={x0 - 6} y={y(v) + 3.5} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        {shown.map((v) => (
          <g key={v}>
            <line x1={lx(distToKm(v, unit))} x2={lx(distToKm(v, unit))} y1={M.t} y2={yb} className="gridline" />
            <text x={lx(distToKm(v, unit))} y={yb + 14} textAnchor="middle" className="axis">{fmt(v, 2)}</text>
          </g>
        ))}
        <text x={(x0 + x1) / 2} y={yb + 30} textAnchor="middle" className="axis">{t('Distance')} ({unit}, log)</text>
        <text x={12} y={M.t + 8} className="axis" transform={`rotate(-90 12 ${M.t + 8})`} textAnchor="end">dBm</text>
        <line x1={x0} x2={x1} y1={y(sens)} y2={y(sens)} className="sens-line" />
        {inp.fadeMargin > 0 && <line x1={x0} x2={x1} y1={y(req)} y2={y(req)} className="req-line" />}
        <path d={path} className="curve" />
        {mark(r.dKm, 'mark-line', `${t('Link')} ${fmt(kmToDist(r.dKm, unit), 3)} ${unit}`, 0)}
        {Number.isFinite(r.maxRangeKm) && r.maxRangeKm > 0 && mark(r.maxRangeKm, 'max-line', `${t('Max range')} ${fmt(kmToDist(r.maxRangeKm, unit), 3)} ${unit}`, 1)}
      </svg>
    </div>
  )
}

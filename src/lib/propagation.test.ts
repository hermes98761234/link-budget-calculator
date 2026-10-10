import { describe, expect, it } from 'vitest'
import { cost231, crossoverDistanceM, fspl, hata, twoRay } from './propagation'
import { rainEffectiveKm, rainLoss, rainSpecific } from './rain'

describe('free space', () => {
  it('matches textbook values', () => {
    expect(fspl(1, 1000)).toBeCloseTo(92.44, 2)
    expect(fspl(1, 2400)).toBeCloseTo(100.04, 2)
    expect(fspl(10, 5800)).toBeCloseTo(127.7, 1)
  })
  it('adds 6 dB per distance doubling and per frequency doubling', () => {
    expect(fspl(2, 900) - fspl(1, 900)).toBeCloseTo(6.0206, 3)
    expect(fspl(1, 1800) - fspl(1, 900)).toBeCloseTo(6.0206, 3)
  })
})

describe('two-ray ground', () => {
  it('is 40 log d - 20 log(ht hr) beyond the crossover', () => {
    expect(twoRay(1, 100, 10, 10)).toBeCloseTo(80, 6)
  })
  it('uses free space inside the crossover and is continuous at it', () => {
    const f = 900
    const dc = crossoverDistanceM(f, 10, 2)
    expect(twoRay(dc / 2000, f, 10, 2)).toBeCloseTo(fspl(dc / 2000, f), 6)
    expect(twoRay((dc * 1.0001) / 1000, f, 10, 2)).toBeCloseTo(twoRay((dc * 0.9999) / 1000, f, 10, 2), 1)
  })
  it('falls 12 dB per distance doubling', () => {
    expect(twoRay(4, 100, 10, 10) - twoRay(2, 100, 10, 10)).toBeCloseTo(12.04, 2)
  })
})

describe('Okumura-Hata', () => {
  it('urban small city, 900 MHz, hb 30 m, hm 1.5 m, 1 km', () => {
    expect(hata(1, 900, 30, 1.5, 'urban')).toBeCloseTo(126.4, 1)
  })
  it('slope is 44.9 - 6.55 log hb per decade', () => {
    const slope = hata(10, 900, 50, 1.5, 'urban') - hata(1, 900, 50, 1.5, 'urban')
    expect(slope).toBeCloseTo(44.9 - 6.55 * Math.log10(50), 6)
  })
  it('suburban and open are progressively lower than urban', () => {
    const u = hata(5, 900, 50, 1.5, 'urban')
    const s = hata(5, 900, 50, 1.5, 'suburban')
    const o = hata(5, 900, 50, 1.5, 'open')
    expect(s).toBeCloseTo(u - 2 * Math.log10(900 / 28) ** 2 - 5.4, 6)
    expect(u - s).toBeCloseTo(9.94, 1)
    expect(o).toBeLessThan(s)
    expect(u - o).toBeCloseTo(28.4, 0)
  })
  it('large-city correction differs by band', () => {
    expect(hata(1, 900, 30, 1.5, 'metro')).toBeCloseTo(126.4 + 0.0159 + 3.2 * Math.log10(11.75 * 1.5) ** 2 - 4.97, 1)
  })
})

describe('COST-231', () => {
  it('medium city, 1800 MHz, hb 30, hm 1.5, 1 km', () => {
    expect(cost231(1, 1800, 30, 1.5, 'urban')).toBeCloseTo(136.2, 1)
  })
  it('adds 3 dB for metropolitan centres', () => {
    expect(cost231(2, 1800, 30, 1.5, 'metro') - cost231(2, 1800, 30, 1.5, 'urban')).toBeCloseTo(3, 9)
  })
})

describe('ITU-R P.838 rain', () => {
  it('10 GHz horizontal at 25 mm/h', () => {
    expect(rainSpecific(10000, 25, 'H')).toBeCloseTo(0.01217 * 25 ** 1.2571, 6)
    expect(rainSpecific(10000, 25, 'H')).toBeCloseTo(0.696, 2)
  })
  it('vertical is a little lower than horizontal at 20 GHz, circular lies between', () => {
    const h = rainSpecific(20000, 30, 'H')
    const v = rainSpecific(20000, 30, 'V')
    const c = rainSpecific(20000, 30, 'C')
    expect(v).toBeLessThan(h)
    expect(c).toBeGreaterThan(v)
    expect(c).toBeLessThan(h)
  })
  it('interpolates between table rows and increases with frequency', () => {
    const a = rainSpecific(9000, 25, 'H')
    expect(a).toBeGreaterThan(rainSpecific(8000, 25, 'H'))
    expect(a).toBeLessThan(rainSpecific(10000, 25, 'H'))
  })
  it('is zero without rain or below 1 GHz', () => {
    expect(rainSpecific(10000, 0, 'H')).toBe(0)
    expect(rainSpecific(900, 50, 'H')).toBe(0)
  })
  it('effective path shortens long links (P.530)', () => {
    expect(rainEffectiveKm(1, 25)).toBeCloseTo(1 / (1 + 1 / (35 * Math.exp(-0.375))), 9)
    expect(rainEffectiveKm(100, 25)).toBeLessThan(30)
    expect(rainLoss(10000, 10, 25, 'H')).toBeCloseTo(rainSpecific(10000, 25, 'H') * rainEffectiveKm(10, 25), 9)
  })
})

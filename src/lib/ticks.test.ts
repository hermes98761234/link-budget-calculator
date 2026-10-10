import { expect, it } from 'vitest'
import { niceTicks } from './ticks'

it('produces round ticks inside the range', () => {
  expect(niceTicks(-103, 7, 6)).toEqual([-100, -80, -60, -40, -20, 0])
  expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
})

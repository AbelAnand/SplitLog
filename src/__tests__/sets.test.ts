import { describe, expect, it } from 'vitest'
import type { SetDetail } from '../api/types'
import { LIMITS } from '../data/limits'
import { loggedSets, matchHints, MAX_WEIGHT, parseReps, parseWeight, repsText, seedDrop, weightText } from '../lib/sets'

const set = (set_type: SetDetail['set_type'], weight = 0, reps = 0, extra: Partial<SetDetail> = {}): SetDetail => ({
  id: `${set_type}-${weight}-${reps}`, set_number: 1, set_type, weight, unit: 'lb', reps, duration_seconds: null, distance: null, distance_unit: null, drops: [], incline: null, extra: {}, created_at: '2026-10-09T10:00:00.000Z', ...extra,
})

describe('typed numbers', () => {
  it('reads weights with a dot or a comma, and never below 0 or above the limit', () => {
    expect(parseWeight('185')).toBe(185)
    expect(parseWeight('22.5')).toBe(22.5)
    expect(parseWeight('22,5')).toBe(22.5)
    expect(parseWeight('100.')).toBe(100)
    expect(parseWeight('')).toBe(0)
    expect(parseWeight('abc')).toBe(0)
    expect(parseWeight('-5')).toBe(0)
    expect(parseWeight('123456')).toBe(MAX_WEIGHT)
  })

  it('reads reps as whole numbers within the limit', () => {
    expect(parseReps('8')).toBe(8)
    expect(parseReps('8.7')).toBe(8)
    expect(parseReps('')).toBe(0)
    expect(parseReps('x')).toBe(0)
    expect(parseReps(String(LIMITS.reps + 1))).toBe(LIMITS.reps)
  })

  it('shows 0 as an empty field and tidies what was typed', () => {
    expect(weightText(0)).toBe('')
    expect(weightText(100)).toBe('100')
    expect(weightText(22.5)).toBe('22.5')
    expect(weightText(parseWeight('100.'))).toBe('100')
    expect(repsText(0)).toBe('')
    expect(repsText(8)).toBe('8')
  })
})

describe('seedDrop', () => {
  it('steps down to about 80% on a plate boundary', () => {
    expect(seedDrop(175, 7, 'lb')).toEqual({ weight: 140, reps: 7 })
    expect(seedDrop(100, 0, 'kg')).toEqual({ weight: 80, reps: 8 })
    expect(seedDrop(5, 8, 'lb')).toEqual({ weight: 5, reps: 8 })
  })

  it('gives an empty set an empty drop rather than a number from nowhere', () => {
    expect(seedDrop(0, 0, 'lb')).toEqual({ weight: 0, reps: 0 })
    expect(seedDrop(0, 8, 'kg')).toEqual({ weight: 0, reps: 0 })
  })
})

describe('last session hints', () => {
  const last = [set('warmup', 45, 10), set('working', 85, 8), set('working', 85, 7), set('working', 85, 6)]

  it('matches working sets with working sets, skipping last time\'s warm-up', () => {
    const today = [set('working'), set('working')]
    expect(matchHints(today, last).map((h) => h && `${h.weight}x${h.reps}`)).toEqual(['85x8', '85x7'])
  })

  it('matches warm-ups with warm-ups wherever they sit', () => {
    const today = [set('warmup'), set('working'), set('warmup'), set('drop'), set('failure')]
    expect(matchHints(today, last).map((h) => h && `${h.weight}x${h.reps}`)).toEqual(['45x10', '85x8', undefined, '85x7', '85x6'])
  })

  it('runs out of hints after last time\'s sets, and gives none without a last session', () => {
    expect(matchHints([set('working'), set('working')], [set('working', 100, 5)]).map((h) => h?.weight)).toEqual([100, undefined])
    expect(matchHints([set('working')], undefined)).toEqual([undefined])
    expect(matchHints([set('working')], [])).toEqual([undefined])
  })

  it('leaves out rows that were never filled in last time', () => {
    const rows = [set('working', 100, 5), set('working'), set('working', 0, 0, { duration_seconds: 600 })]
    expect(loggedSets(rows, false).map((s) => s.weight)).toEqual([100])
    expect(loggedSets(rows, true).map((s) => s.duration_seconds)).toEqual([600])
    expect(loggedSets([set('working')], false)).toEqual([])
  })
})

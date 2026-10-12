import { describe, expect, it } from 'vitest'
import type { SetDetail, WorkoutDetail, WorkoutExerciseDetail } from '../api/types'
import type { SetRow } from '../lib/prs'
import { cardContent } from '../lib/share-card'
import { minutesText, prSetIds, strengthSetText, unitsUsed, workoutSummaryText } from '../lib/share-workout'

/*
 * The words a shared workout is made of: the text that goes into a message, the lines on the
 * picture card, and which sets they call records.
 */

const at = '2026-10-10T18:00:00.000Z'
const now = new Date('2026-10-12T12:00:00')

const set = (id: string, n: number, weight: number, reps: number, extra: Partial<SetDetail> = {}): SetDetail => ({ id, set_number: n, set_type: 'working', weight, unit: 'lb', reps, duration_seconds: null, distance: null, distance_unit: null, drops: [], incline: null, extra: {}, created_at: at, ...extra })
const exercise = (id: string, name: string, sets: SetDetail[], extra: Partial<WorkoutExerciseDetail> = {}): WorkoutExerciseDetail => ({ id, exercise_id: `x-${id}`, name, kind: 'strength', track_incline: false, metrics: [], position: 0, notes: '', planned: false, completed_at: null, sets, ...extra })
const workout = (exercises: WorkoutExerciseDetail[], extra: Partial<WorkoutDetail> = {}): WorkoutDetail => ({ id: 'w', title: 'Pull', date: '2026-10-10', notes: '', created_at: at, started_at: at, finished_at: '2026-10-10T19:44:00.000Z', paused_at: null, paused_seconds: 0, is_plan: false, exercises, ...extra })

/** A set from another workout, as the PR rule sees history. */
const row = (exerciseId: string, weight: number, extra: Partial<SetRow> = {}): SetRow => ({ ...set(`h-${exerciseId}-${weight}`, 1, weight, 5), workout_exercise_id: 'h', exercise_id: exerciseId, exercise_name: '', exercise_kind: 'strength', workout_id: 'earlier', workout_title: 'Pull', date: '2026-10-03', ...extra })

const pull = workout([
  exercise('e1', 'Lat Pullover', [set('s1', 1, 80, 5, { set_type: 'warmup' }), set('s2', 2, 150, 6, { set_type: 'drop', drops: [{ weight: 110, reps: 8 }] }), set('s3', 3, 150, 6, { set_type: 'drop', drops: [{ weight: 110, reps: 8 }, { weight: 90, reps: 10 }] }), set('s4', 4, 150, 6, { set_type: 'failure' })]),
  exercise('e2', 'Pull-up', [set('s5', 1, 0, 12), set('s6', 2, 0, 10)], { notes: 'wide grip' }),
  exercise('e3', 'Rowing', [set('s7', 1, 0, 0, { duration_seconds: 1200, distance: 2.5, distance_unit: 'mi', extra: { speed: 7.5 } })], { kind: 'cardio', metrics: ['time', 'distance', 'speed'] }),
], { notes: 'Back felt tight, kept it light' })

describe('the text summary', () => {
  it('reads as a header, one block per exercise, notes, and where it came from', () => {
    expect(workoutSummaryText(pull, { now })).toBe(
      [
        'Pull · Sat Oct 10',
        '1 h 44 min · 3 exercises · 7 sets',
        'Weights in lb',
        '',
        'Lat Pullover',
        'Warm-up 80 × 5',
        '150 × 6, then 110 × 8',
        '150 × 6, then 110 × 8, then 90 × 10',
        '150 × 6 to failure',
        '',
        'Pull-up',
        '× 12',
        '× 10',
        '(wide grip)',
        '',
        'Rowing',
        '20 min · 2.5 mi · 7.5 mph',
        '',
        'Back felt tight, kept it light',
        '',
        'Logged with SplitLog',
      ].join('\n'),
    )
  })

  it('has no leading spaces, em dashes or arrows anywhere', () => {
    const text = workoutSummaryText(pull, { now, link: true })
    for (const line of text.split('\n')) expect(line).toBe(line.trimStart())
    expect(text).not.toMatch(/[—↓→]/)
  })

  it('marks a record set with a trailing PR', () => {
    const text = workoutSummaryText(pull, { now, prs: new Set(['s2']) })
    expect(text).toContain('\n150 × 6, then 110 × 8 PR\n')
  })

  it('ends with the site address only when asked', () => {
    expect(workoutSummaryText(pull, { now }).endsWith('Logged with SplitLog')).toBe(true)
    expect(workoutSummaryText(pull, { now, link: true }).endsWith('Logged with SplitLog\nhttps://abelanand.github.io/SplitLog/')).toBe(true)
  })

  it('says planned for a plan and leaves out the duration', () => {
    const lines = workoutSummaryText(workout(pull.exercises, { is_plan: true, finished_at: null }), { now }).split('\n')
    expect(lines[0]).toBe('Pull · Planned for Sat Oct 10')
    expect(lines[1]).toBe('3 exercises · 7 sets')
  })

  it('leaves out a duration that was not tracked sensibly', () => {
    const lines = workoutSummaryText(workout(pull.exercises, { finished_at: null }), { now }).split('\n')
    expect(lines[1]).toBe('3 exercises · 7 sets')
  })

  it('adds the year to a date from another year', () => {
    expect(workoutSummaryText(workout([], { date: '2025-12-30' }), { now }).split('\n')[0]).toBe('Pull · Tue Dec 30, 2025')
  })

  it('with mixed units, each exercise says its own after its first weight', () => {
    const w = workout([
      exercise('e1', 'Squat', [set('s1', 1, 100, 5, { unit: 'kg' }), set('s2', 2, 100, 5, { unit: 'kg' })]),
      exercise('e2', 'Leg Press', [set('s3', 1, 270, 10), set('s4', 2, 130, 10, { unit: 'kg' })]),
    ])
    const lines = workoutSummaryText(w, { now }).split('\n')
    expect(lines[2]).toBe('')
    expect(lines.slice(3, 6)).toEqual(['Squat', '100 kg × 5', '100 × 5'])
    expect(lines.slice(7, 10)).toEqual(['Leg Press', '270 lb × 10', '130 kg × 10'])
    expect(unitsUsed(w)).toEqual(['kg', 'lb'])
  })

  it('writes singular counts and a workout with no title', () => {
    const w = workout([exercise('e1', 'Squat', [set('s1', 1, 225, 5)])], { title: '' })
    expect(workoutSummaryText(w, { now }).split('\n').slice(0, 2)).toEqual(['Workout · Sat Oct 10', '1 h 44 min · 1 exercise · 1 set'])
  })

  it("writes cardio figures in the exercise's own order, then anything else logged", () => {
    const we = exercise('e', 'Stairs', [set('s', 1, 0, 0, { duration_seconds: 1530, incline: 4, extra: { level: 8, floors: 40, hr: 150 } })], { kind: 'cardio', metrics: ['time', 'level', 'floors'] })
    expect(workoutSummaryText(workout([we]), { now })).toContain('\nStairs\n25 min 30 s · level 8 · 40 floors · 4% incline · 150 bpm\n')
  })

  it('writes short and long times', () => {
    expect(minutesText(45)).toBe('45 s')
    expect(minutesText(1200)).toBe('20 min')
    expect(minutesText(3900)).toBe('1 h 5 min')
    expect(minutesText(3600)).toBe('1 h')
  })

  it('words a single set every way it can be', () => {
    expect(strengthSetText(set('a', 1, 150, 6), null)).toBe('150 × 6')
    expect(strengthSetText(set('a', 1, 150, 6), 'kg')).toBe('150 kg × 6')
    expect(strengthSetText(set('a', 1, 0, 12), 'lb')).toBe('× 12')
    expect(strengthSetText(set('a', 1, 150, 6, { set_type: 'drop', drops: [{ weight: 110, reps: 8 }] }), null, false, ' → ')).toBe('150 × 6 → 110 × 8')
    expect(strengthSetText(set('a', 1, 150, 6, { set_type: 'failure' }), null, true)).toBe('150 × 6 to failure PR')
    expect(strengthSetText(set('a', 1, 102.5, 6), null)).toBe('102.5 × 6')
  })
})

describe('records on a shared workout', () => {
  it("uses the editor's rule: the first working set at a top weight that beats every other workout", () => {
    const history = [row('x-e1', 140), row('x-e1', 145, { workout_id: 'later', date: '2026-10-11' })]
    expect([...prSetIds(pull, history)]).toEqual(['s2'])
    expect(prSetIds(pull, [row('x-e1', 150)]).size).toBe(0)
    // The workout's own sets in history do not count against it.
    expect(prSetIds(pull, [...history, ...pull.exercises[0].sets.map((s) => ({ ...row('x-e1', s.weight), id: s.id, workout_id: 'w' }))]).size).toBe(1)
  })

  it('never counts warm-ups, bodyweight, cardio or a plan', () => {
    expect(prSetIds(workout([exercise('e1', 'Lat Pullover', [set('s1', 1, 80, 5, { set_type: 'warmup' })])]), []).size).toBe(0)
    expect(prSetIds(pull, []).has('s5')).toBe(false)
    expect(prSetIds(pull, []).has('s7')).toBe(false)
    expect(prSetIds(workout(pull.exercises, { is_plan: true }), []).size).toBe(0)
  })
})

describe('the picture card', () => {
  it('carries the title, date and length, one block per exercise and the totals', () => {
    const c = cardContent(pull, { now, prs: new Set(['s2']) })
    expect(c.title).toBe('Pull')
    expect(c.subtitle).toBe('Sat Oct 10 · 1 h 44 min')
    expect(c.blocks.map((b) => b.name)).toEqual(['Lat Pullover', 'Pull-up', 'Rowing'])
    expect(c.blocks[0].sets.map((s) => s.text)).toEqual(['Warm-up 80 × 5', '150 × 6, then 110 × 8', '150 × 6, then 110 × 8, then 90 × 10', '150 × 6 to failure'])
    expect(c.blocks[0].tight[1].text).toBe('150 × 6 → 110 × 8')
    expect(c.blocks[0].sets.map((s) => s.pr)).toEqual([false, true, false, false])
    expect(c.blocks[2].sets[0].text).toBe('20 min · 2.5 mi · 7.5 mph')
    // Volume: the three working sets with their drops (warm-up and bodyweight do not count).
    expect(c.totals).toBe('7 sets · 5,360 lb · 1 PR')
  })

  it('counts volume in the first unit used and shows the other unit on its sets', () => {
    const w = workout([exercise('e1', 'Squat', [set('s1', 1, 100, 5, { unit: 'kg' }), set('s2', 2, 220, 5)])])
    const c = cardContent(w, { now })
    expect(c.blocks[0].sets.map((s) => s.text)).toEqual(['100 × 5', '220 lb × 5'])
    expect(c.totals).toBe('2 sets · 999 kg')
  })

  it('says planned for a plan', () => {
    const c = cardContent(workout([], { is_plan: true, title: '' }), { now })
    expect(c.subtitle).toBe('Planned for Sat Oct 10')
    expect(c.title).toBe('Workout')
  })
})

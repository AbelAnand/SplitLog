import type { NewSet } from '../api/optimistic'
import type { Drop, SetDetail, SetType } from '../api/types'
import { LIMITS } from '../data/limits'
import { formatWeight, stepFor, type DistanceUnit, type Unit } from './units'

/*
 * What "empty" means for a set. Weight and reps are numbers in storage, so an empty strength set
 * is 0 × 0; a cardio interval is empty when none of its metrics has a value. The rows show an
 * empty field (with last session's number as ghost text) for 0 and null, never a typed "0".
 */

type MetricSet = Pick<SetDetail, 'duration_seconds' | 'distance' | 'incline' | 'extra'>

export function hasAnyMetric(s: MetricSet): boolean {
  return !!s.duration_seconds || !!s.distance || !!s.incline || Object.values(s.extra).some((v) => !!v)
}

export function isBlank(s: Pick<SetDetail, 'weight' | 'reps'> & MetricSet, cardio: boolean): boolean {
  return cardio ? !hasAnyMetric(s) : s.weight === 0 && s.reps === 0
}

/** The sets of a session that were actually logged: a row left empty is not "last time's numbers". */
export function loggedSets<T extends Pick<SetDetail, 'weight' | 'reps'> & MetricSet>(sets: T[], cardio: boolean): T[] {
  return sets.filter((s) => !isBlank(s, cardio))
}

/**
 * The set "Add set" / "Add interval" appends: nothing typed, so the row shows its placeholders and
 * last session's numbers as hints. Only the units carry over from the set above (or the profile).
 * A drop set starts with one empty drop so the row has somewhere to type.
 */
export function blankSet(opts: { after?: Pick<SetDetail, 'set_number' | 'unit' | 'distance_unit'> | null; type?: SetType; unit: Unit; distanceUnit: DistanceUnit; cardio: boolean }): NewSet {
  const { after, type = 'working', unit, distanceUnit, cardio } = opts
  return {
    set_number: (after?.set_number ?? 0) + 1,
    weight: 0,
    reps: 0,
    unit: after?.unit ?? unit,
    set_type: type,
    duration_seconds: null,
    distance: null,
    distance_unit: cardio ? after?.distance_unit ?? distanceUnit : null,
    drops: type === 'drop' ? [{ weight: 0, reps: 0 }] : [],
    incline: null,
    extra: {},
  }
}

/** The heaviest weight a set can hold; the database refuses more (src/db/clean.ts). */
export const MAX_WEIGHT = 99999

/** Typed weight → number: "22,5" reads as 22.5, anything unreadable or negative is 0. */
export function parseWeight(text: string): number {
  return Math.min(MAX_WEIGHT, Math.max(0, parseFloat(text.replace(',', '.')) || 0))
}

/** Typed reps → whole number within the limit; unreadable or negative is 0. */
export function parseReps(text: string): number {
  return Math.min(LIMITS.reps, Math.max(0, parseInt(text, 10) || 0))
}

/** How a number shows in a weight field: nothing for 0, otherwise at most one decimal. */
export function weightText(weight: number): string {
  return weight ? formatWeight(weight) : ''
}

/** How a number shows in a reps field: nothing for 0. */
export function repsText(reps: number): string {
  return reps ? String(reps) : ''
}

/**
 * A sensible first drop below a set: about 80% of its weight, rounded to a plate. A set with no
 * weight yet gets an empty drop, so the row has somewhere to type rather than a number from nowhere.
 */
export function seedDrop(weight: number, reps: number, unit: Unit): Drop {
  if (!weight) return { weight: 0, reps: 0 }
  const step = stepFor(unit)
  return { weight: Math.max(step, Math.round((weight * 0.8) / step) * step), reps: reps || 8 }
}

/**
 * Last session's numbers for each of today's sets, shown as ghost text in empty fields.
 * Warm-ups are matched with last time's warm-ups and working sets with working sets, in order, so
 * the first working set today shows the first working set of last time even when the warm-ups
 * differ in number. Beyond what last time had, there is no hint.
 */
export function matchHints<T extends Pick<SetDetail, 'set_type'>, H extends Pick<SetDetail, 'set_type'>>(sets: T[], last: H[] | undefined): (H | undefined)[] {
  if (!last?.length) return sets.map(() => undefined)
  const warm = (s: Pick<SetDetail, 'set_type'>) => s.set_type === 'warmup'
  const lastWarm = last.filter(warm)
  const lastWork = last.filter((s) => !warm(s))
  let w = 0
  let n = 0
  return sets.map((s) => (warm(s) ? lastWarm[w++] : lastWork[n++]))
}

import { format, parseISO } from 'date-fns'
import type { SetDetail, WorkoutDetail, WorkoutExerciseDetail } from '../api/types'
import { METRICS, METRIC_BY_KEY, type MetricKey } from '../data/cardio-metrics'
import { db } from '../db'
import { serializeBackup } from '../db/backup'
import { sharedFilename, sharedWorkoutFile } from '../db/share'
import { shareTextFile, type ShareResult } from './csv'
import { formatSessionLength } from './duration'
import { bestByExercise, type SetRow } from './prs'
import { shareBinaryFile, shareText, type TextShareResult } from './share-file'
import { WEB_URL } from './site'
import { formatWeight, toKg, type Unit } from './units'

/**
 * Sharing one workout, as one of three things: a plain text that reads well in a message, a
 * picture card (share-card.ts), or the file another SplitLog user opens straight into their
 * calendar (db/share.ts). Each goes to the share sheet alone.
 */

export type ShareKind = 'image' | 'text' | 'file'

type Workout = Pick<WorkoutDetail, 'id' | 'title' | 'date' | 'notes' | 'is_plan' | 'exercises' | 'started_at' | 'finished_at' | 'paused_at' | 'paused_seconds'>

/* ---- Personal records, by the editor's rule ---- */

/**
 * The sets that are records in this workout: per strength exercise, the first working set at
 * the session's top weight when that beats every other workout's best. Plans have none.
 * The same rule as the editor (ExerciseCard with `bestByExercise(allSets, workout.id)`).
 */
export function prSetIds(w: Pick<WorkoutDetail, 'id' | 'is_plan' | 'exercises'>, allSets: SetRow[]): Set<string> {
  const ids = new Set<string>()
  if (w.is_plan) return ids
  const prevBest = bestByExercise(allSets, w.id)
  for (const we of w.exercises) {
    if (we.kind === 'cardio') continue
    const working = we.sets.filter((s) => s.reps > 0 && s.set_type !== 'warmup')
    const topKg = working.reduce((top, s) => Math.max(top, toKg(s.weight, s.unit)), 0)
    if (topKg === 0 || topKg <= (prevBest.get(we.exercise_id) ?? 0)) continue
    const first = working.find((s) => toKg(s.weight, s.unit) === topKg)
    if (first) ids.add(first.id)
  }
  return ids
}

/* ---- Words for sets ---- */

export const TIMES = ' × '

/** "150 × 6", "× 12" for bodyweight; the unit after the weight when asked. */
function weightReps(weight: number, reps: number, unit: Unit | null): string {
  const w = weight > 0 ? `${formatWeight(weight)}${unit ? ` ${unit}` : ''}` : ''
  return `${w}${w ? TIMES : '× '}${reps}`
}

/**
 * A strength set in words: "150 × 6", "Warm-up 80 × 5", "150 × 6 to failure",
 * "150 × 6, then 110 × 8" for a drop set. `unit` is written after the first weight when given.
 */
export function strengthSetText(s: SetDetail, unit: Unit | null, pr = false, then = ', then '): string {
  const parts = [weightReps(s.weight, s.reps, unit)]
  if (s.set_type === 'drop') for (const d of s.drops) parts.push(weightReps(d.weight, d.reps, null))
  let text = parts.join(then)
  if (s.set_type === 'warmup') text = `Warm-up ${text}`
  if (s.set_type === 'failure') text += ' to failure'
  if (pr) text += ' PR'
  return text
}

/** "20 min", "25 min 30 s", "1 h 5 min". */
export function minutesText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts: string[] = []
  if (h) parts.push(`${h} h`)
  if (m) parts.push(`${m} min`)
  if (sec && !h) parts.push(`${sec} s`)
  return parts.length ? parts.join(' ') : '0 min'
}

function metricText(key: MetricKey, s: SetDetail): string | null {
  const du = s.distance_unit ?? 'mi'
  if (key === 'time') return s.duration_seconds ? minutesText(s.duration_seconds) : null
  if (key === 'distance') return s.distance ? `${Math.round(s.distance * 100) / 100} ${du}` : null
  if (key === 'incline') return s.incline ? `${s.incline}% incline` : null
  const n = s.extra[key]
  if (!n) return null
  const unit = METRIC_BY_KEY[key].unit(du)
  return key === 'level' ? `level ${n}` : key === 'floors' ? `${n} floors` : `${n}${unit ? ` ${unit}` : ''}`
}

/** A cardio set in words: the exercise's own columns first, in order, then anything else logged. */
export function cardioSetText(we: Pick<WorkoutExerciseDetail, 'metrics'>, s: SetDetail): string {
  const keys: MetricKey[] = [...we.metrics, ...METRICS.map((m) => m.key).filter((k) => !we.metrics.includes(k))]
  const parts = keys.map((k) => metricText(k, s)).filter((v): v is string => !!v)
  return parts.length ? parts.join(' · ') : 'no figures logged'
}

/** Weight units used by the workout's strength sets, in order of first use. */
export function unitsUsed(w: Pick<WorkoutDetail, 'exercises'>): Unit[] {
  const units: Unit[] = []
  for (const we of w.exercises) {
    if (we.kind === 'cardio') continue
    for (const s of we.sets) {
      if ((s.weight > 0 || s.drops.some((d) => d.weight > 0)) && !units.includes(s.unit)) units.push(s.unit)
    }
  }
  return units
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** "Fri Oct 10", with the year when it is not this year. */
export function shortDate(date: string, now: Date): string {
  const d = parseISO(date)
  return format(d, d.getFullYear() === now.getFullYear() ? 'EEE MMM d' : 'EEE MMM d, yyyy')
}

/** "Fri Oct 10", or "Planned for Fri Oct 10". */
export function whenText(w: Pick<WorkoutDetail, 'date' | 'is_plan'>, now: Date): string {
  return `${w.is_plan ? 'Planned for ' : ''}${shortDate(w.date, now)}`
}

/** Title line and stats line: "Pull · Fri Oct 10" / "1 h 44 min · 5 exercises · 23 sets". */
export function headerLines(w: Workout, now: Date): [string, string] {
  const setCount = w.exercises.reduce((n, we) => n + we.sets.length, 0)
  const stats = [plural(w.exercises.length, 'exercise'), plural(setCount, 'set')]
  const length = w.is_plan ? null : formatSessionLength(w)
  if (length) stats.unshift(length)
  return [`${w.title || 'Workout'} · ${whenText(w, now)}`, stats.join(' · ')]
}

/**
 * A workout as a message: a header, one block per exercise with one set per line, the notes,
 * and where it came from. The unit is said once in the header when the workout uses one; with
 * mixed units each exercise says its own after its first weight.
 */
export function workoutSummaryText(w: Workout, options: { prs?: Set<string>; link?: boolean; now?: Date } = {}): string {
  const now = options.now ?? new Date()
  const prs = options.prs ?? new Set<string>()
  const units = unitsUsed(w)
  const single = units.length === 1 ? units[0] : null
  const blocks: string[] = []
  const header = headerLines(w, now)
  if (single) header.push(`Weights in ${single}`)
  blocks.push(header.join('\n'))
  for (const we of w.exercises) {
    const lines = [we.name]
    if (we.kind === 'cardio') {
      for (const s of we.sets) lines.push(cardioSetText(we, s))
    } else {
      let said: Unit | null = single
      for (const s of we.sets) {
        const showUnit = s.weight > 0 && s.unit !== said
        lines.push(strengthSetText(s, showUnit ? s.unit : null, prs.has(s.id)))
        if (showUnit) said = s.unit
      }
    }
    if (we.notes.trim()) lines.push(`(${we.notes.trim()})`)
    blocks.push(lines.join('\n'))
  }
  if (w.notes.trim()) blocks.push(w.notes.trim())
  blocks.push(options.link ? `Logged with SplitLog\n${WEB_URL}` : 'Logged with SplitLog')
  return blocks.join('\n\n')
}

/* ---- Sharing ---- */

async function loaded(workoutId: string): Promise<{ w: WorkoutDetail; prs: Set<string> }> {
  await db.open()
  await db.flushed()
  const w = db.getWorkout(workoutId)
  return { w, prs: prSetIds(w, db.allSets()) }
}

/** "SplitLog - Push - 2026-10-09.png" */
function imageFilename(title: string, date: string): string {
  return sharedFilename(title, date).replace(/\.json$/, '.png')
}

/** The text summary. In a browser without the share API it is copied, without the site address. */
export async function shareWorkoutText(workoutId: string): Promise<TextShareResult> {
  const { w, prs } = await loaded(workoutId)
  const title = `${w.title || 'Workout'} · SplitLog`
  const result = await shareText(workoutSummaryText(w, { prs, link: true }), title)
  if (result === 'copied') await navigator.clipboard.writeText(workoutSummaryText(w, { prs }))
  return result
}

/** The picture card, as a PNG file. */
export async function shareWorkoutImage(workoutId: string): Promise<ShareResult> {
  const { w, prs } = await loaded(workoutId)
  const { renderWorkoutCard } = await import('./share-card')
  const blob = await renderWorkoutCard(w, { prs })
  return shareBinaryFile(imageFilename(w.title, w.date), blob)
}

/** The file for someone with SplitLog. */
export async function shareWorkoutFile(workoutId: string): Promise<ShareResult> {
  const { w } = await loaded(workoutId)
  return shareTextFile(sharedFilename(w.title, w.date), serializeBackup(sharedWorkoutFile(db, workoutId)), 'application/json')
}

/** Share a workout one way; the picture when no way is named. */
export function shareWorkout(workoutId: string, kind: ShareKind = 'image'): Promise<TextShareResult> {
  if (kind === 'text') return shareWorkoutText(workoutId)
  if (kind === 'file') return shareWorkoutFile(workoutId)
  return shareWorkoutImage(workoutId)
}

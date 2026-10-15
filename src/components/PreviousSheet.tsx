import { format, parseISO } from 'date-fns'
import { useWorkout } from '../api/queries'
import type { SetDetail, WorkoutExerciseDetail } from '../api/types'
import { cardioSetText } from '../lib/share-workout'
import { convert, formatWeight, type DistanceUnit, type Unit } from '../lib/units'
import { Button, Icon, Sheet } from './ui'

/*
 * Looking at last time before deciding anything. Every set of the previous session, with its
 * type, in the current units: the hint line under an exercise only has room for a summary, and
 * a warm-up, a working set and a drop set are different numbers to compare against.
 */

type PreviewSet = Pick<SetDetail, 'weight' | 'unit' | 'reps' | 'set_type' | 'duration_seconds' | 'distance' | 'distance_unit' | 'drops' | 'incline' | 'extra'>

function setLabel(s: PreviewSet, index: number): string {
  if (s.set_type === 'warmup') return 'W'
  return `${index}${s.set_type === 'drop' ? 'D' : s.set_type === 'failure' ? 'F' : ''}`
}

function strengthText(s: PreviewSet, unit: Unit): string {
  const show = (w: number) => (w > 0 ? `${formatWeight(convert(w, s.unit, unit))} ${unit}` : 'bodyweight')
  const parts = [`${show(s.weight)} × ${s.reps}`, ...s.drops.map((d) => `then ${show(d.weight)} × ${d.reps}`)]
  return parts.join(', ') + (s.set_type === 'failure' ? ' to failure' : '')
}

/** The rows of one exercise's previous session. */
export function PreviousSets({ sets, cardio, metrics, unit, distanceUnit }: { sets: PreviewSet[]; cardio: boolean; metrics: WorkoutExerciseDetail['metrics']; unit: Unit; distanceUnit: DistanceUnit }) {
  let n = 0
  return (
    <ul className="flex flex-col gap-1.5">
      {sets.map((s, i) => {
        if (s.set_type !== 'warmup') n += 1
        const label = setLabel(s, n)
        const text = cardio ? cardioSetText({ metrics }, { ...s, distance_unit: s.distance_unit ?? distanceUnit } as SetDetail) : strengthText(s, unit)
        return (
          <li key={i} className="flex items-center gap-3 text-[15px]">
            <span className={`h-7 min-w-7 px-1 rounded-lg flex items-center justify-center text-[13px] font-semibold ${s.set_type === 'warmup' ? 'bg-surface-3 text-muted' : s.set_type === 'working' ? 'bg-surface-2 text-muted' : 'bg-accent-dim text-accent'}`}>{label}</span>
            <span className="tabular">{text}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** One exercise's last session, with the choice to use those sets or just close. */
export function LastSessionSheet({ open, onClose, name, date, sets, cardio, metrics, unit, distanceUnit, onUse }: { open: boolean; onClose: () => void; name: string; date: string; sets: PreviewSet[]; cardio: boolean; metrics: WorkoutExerciseDetail['metrics']; unit: Unit; distanceUnit: DistanceUnit; onUse: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={name}>
      <p className="text-muted text-[14px] mb-3">Last time, {date}</p>
      <div className="rounded-2xl bg-surface-2 px-4 py-3 mb-4">
        <PreviousSets sets={sets} cardio={cardio} metrics={metrics} unit={unit} distanceUnit={distanceUnit} />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Close</Button>
        <Button size="lg" className="flex-1" onClick={() => { onUse(); onClose() }}><Icon.Repeat /> Use these sets</Button>
      </div>
    </Sheet>
  )
}

/** The whole previous workout with the same title, before it is repeated. */
export function PreviousWorkoutSheet({ workoutId, onClose, onRepeat, plan, unit, distanceUnit }: { workoutId: string | null; onClose: () => void; onRepeat: () => void; plan: boolean; unit: Unit; distanceUnit: DistanceUnit }) {
  const { data: w } = useWorkout(workoutId ?? undefined)
  return (
    <Sheet open={!!workoutId} onClose={onClose} title={w ? `${w.title || 'Workout'}, ${format(parseISO(w.date), 'EEE, MMM d')}` : 'Last time'}>
      {w && (
        <>
          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 mb-4 flex flex-col gap-3">
            {w.exercises.map((we) => (
              <div key={we.id} className="rounded-2xl bg-surface-2 px-4 py-3">
                <div className="text-[15px] font-semibold mb-2">{we.name}</div>
                {we.sets.length ? <PreviousSets sets={we.sets} cardio={we.kind === 'cardio'} metrics={we.metrics} unit={unit} distanceUnit={distanceUnit} /> : <div className="text-[13px] text-muted">No sets</div>}
                {we.notes.trim() && <div className="mt-2 text-[13px] text-muted">{we.notes.trim()}</div>}
              </div>
            ))}
          </div>
          <p className="text-muted text-[13px] mb-3">{plan ? 'The plan gets these exercises with one empty set each.' : 'You get these exercises with one empty set each; last time\'s numbers show in grey as you log.'}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Close</Button>
            <Button size="lg" className="flex-1" onClick={() => { onRepeat(); onClose() }}><Icon.Repeat /> {plan ? 'Base it on this' : 'Repeat'}</Button>
          </div>
        </>
      )}
    </Sheet>
  )
}

import { useState, type ReactNode } from 'react'
import { useWorkout } from '../api/queries'
import { tap } from '../lib/haptics'
import { shareWorkout, type ShareKind } from '../lib/share-workout'
import { toast } from '../lib/toast'
import { Sheet, Spinner } from './ui'

/**
 * "Share": pick one of three things to hand out, each on its own through the share sheet.
 * The picture is first because it is what most people want to send. The chooser stays open
 * when the share sheet is dismissed, so another option is one tap away.
 */
export function ShareWorkoutSheet({ workoutId, onClose }: { workoutId: string | null; onClose: () => void }) {
  const { data: workout } = useWorkout(workoutId ?? undefined)
  const [busy, setBusy] = useState<ShareKind | null>(null)

  const share = async (kind: ShareKind) => {
    if (!workoutId || busy) return
    tap()
    setBusy(kind)
    try {
      const result = await shareWorkout(workoutId, kind)
      if (result === 'cancelled') return
      if (result === 'downloaded') toast(kind === 'image' ? 'Image downloaded.' : 'File downloaded.', 'info')
      if (result === 'copied') toast('Summary copied.', 'info')
      onClose()
    } catch {
      toast("Couldn't share the workout. Try again.")
    } finally {
      setBusy(null)
    }
  }

  const title = workout?.title || 'Workout'
  return (
    <Sheet open={!!workoutId} onClose={onClose} title={`Share ${title}`}>
      <div className="flex flex-col gap-2 pt-1 pb-1">
        <Option kind="image" label="Image" sub="A card of the session for Instagram, Messages, anywhere" icon={<ImageIcon />} busy={busy} onPick={share} />
        <Option kind="text" label="Text" sub="A plain summary that reads well in a message" icon={<TextIcon />} busy={busy} onPick={share} />
        <Option kind="file" label="SplitLog file" sub="For someone with SplitLog: opens straight into their calendar" icon={<FileIcon />} busy={busy} onPick={share} />
      </div>
    </Sheet>
  )
}

function Option({ kind, label, sub, icon, busy, onPick }: { kind: ShareKind; label: string; sub: string; icon: ReactNode; busy: ShareKind | null; onPick: (kind: ShareKind) => void }) {
  const working = busy === kind
  return (
    <button
      type="button"
      onClick={() => onPick(kind)}
      disabled={!!busy}
      aria-busy={working}
      className={`press-soft w-full flex items-center gap-4 rounded-2xl bg-surface-2 border border-border/60 px-4 py-4 text-left active:bg-surface-3 ${busy && !working ? 'opacity-50' : ''}`}
    >
      <span className="shrink-0 h-12 w-12 rounded-xl bg-accent-dim text-accent flex items-center justify-center">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[17px] font-semibold">{label}</span>
        <span className="block text-[13px] text-muted leading-snug mt-0.5">{sub}</span>
      </span>
      {working && <Spinner className="shrink-0" />}
    </button>
  )
}

/* Icons for the three options (24px, stroke), the style of ui.tsx's Icon set. */
const ico = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const ImageIcon = () => (
  <svg {...ico} aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-7 7M8 20l-5-4" /></svg>
)
const TextIcon = () => (
  <svg {...ico} aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10" /></svg>
)
const FileIcon = () => (
  <svg {...ico} aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 14h8M8 17h8" /></svg>
)

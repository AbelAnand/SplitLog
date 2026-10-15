import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { tap } from './haptics'

/*
 * Hold a row and drag it to a new place in its list.
 *
 * The caller starts a drag from its long-press handler (`lift`); from then on the finger is
 * followed on the document, so the drag survives leaving the row. The first clear movement decides
 * what the gesture is: sideways hands it back (a swipe row underneath takes over), up or down
 * moves the row. While a row is being moved, the page does not scroll (touchmove is cancelled) and
 * a focused field keeps its keyboard (`data-keep-keyboard`, read by src/main.tsx).
 *
 * Rows are measured once, when picked up, relative to the list, so page scroll cannot upset the
 * numbers. The lifted row follows the finger with an inline transform; the rows it passes shift
 * by its height with a short transition. Only `transform` is animated (see the Motion section of
 * app.css), and Reduce Motion turns the transition off.
 */

/** How long the rows making room take to slide. */
export const SHIFT_MS = 150
const SLOP = 6

interface Slot { top: number; height: number }

interface Drag {
  /** The order the list had when the row was picked up; the drag ends when the list changes. */
  key: string
  from: number
  to: number
  /** How far the lifted row has moved from where it was. */
  dy: number
  slots: Slot[]
  axis: 'y' | null
  /** Dropped: sliding into its new slot while the list is told. */
  settling: boolean
  reduced: boolean
}

const prefersReduced = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Where the lifted row's top ends up relative to where it started, once it is dropped at `to`. */
function settleOffset(d: Drag): number {
  let y = 0
  if (d.to > d.from) for (let i = d.from + 1; i <= d.to; i++) y += d.slots[i].height
  else for (let i = d.to; i < d.from; i++) y -= d.slots[i].height
  return y
}

export function useReorder(ids: readonly string[], onMove: (from: number, to: number) => void) {
  const container = useRef<HTMLDivElement | null>(null)
  const slotEls = useRef(new Map<string, HTMLElement>())
  const [drag, setDrag] = useState<Drag | null>(null)
  const latest = useRef<Drag | null>(null)
  const startClient = useRef({ x: 0, y: 0 })
  const startY = useRef(0)
  const timers = useRef<number[]>([])
  const pending = useRef<(() => void) | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const key = ids.join('\n')

  const update = (d: Drag | null) => {
    latest.current = d
    setDrag(d)
  }

  // Once the list changes (the move has been applied, or something else happened), the
  // measurements no longer describe what is on screen, so the drag is over.
  const live = drag && drag.key === key ? drag : null
  useEffect(() => {
    if (drag && drag.key !== key) update(null)
  }, [drag, key])

  useEffect(() => {
    const pendingTimers = timers.current
    return () => {
      pendingTimers.forEach((t) => window.clearTimeout(t))
      // Leaving the screen mid-settle must still apply the move.
      pending.current?.()
    }
  }, [])

  const lift = (index: number, press: { clientX: number; clientY: number }) => {
    const c = container.current
    if (!c || latest.current) return
    const cTop = c.getBoundingClientRect().top
    const slots = ids.map((id) => {
      const r = slotEls.current.get(id)?.getBoundingClientRect()
      return r ? { top: r.top - cTop, height: r.height } : { top: 0, height: 0 }
    })
    startClient.current = { x: press.clientX, y: press.clientY }
    startY.current = press.clientY - cTop
    update({ key, from: index, to: index, dy: 0, slots, axis: null, settling: false, reduced: prefersReduced() })
  }

  const drop = () => {
    const d = latest.current
    if (!d || d.settling) return
    tap()
    if (d.axis !== 'y' || d.to === d.from) return update(null)
    update({ ...d, dy: settleOffset(d), settling: true })
    const go = () => {
      pending.current = null
      onMoveRef.current(d.from, d.to)
    }
    pending.current = go
    timers.current.push(window.setTimeout(go, d.reduced ? 0 : SHIFT_MS))
    // If the list did not change (nothing to apply the move to), let go of the row anyway.
    timers.current.push(window.setTimeout(() => { if (latest.current?.settling) update(null) }, SHIFT_MS + 450))
  }

  const active = !!live && !live.settling
  const finger = useRef<{ x: number; y: number } | null>(null)

  // WebKit decides at the start of a touch whether its moves can be cancelled, from the listeners
  // present at that moment. A non-passive touchmove listener added only once a row is lifted comes
  // too late: the page scrolls and the drag is cancelled. So the listener is always there and does
  // nothing unless a row is being held.
  useEffect(() => {
    const stopScroll = (e: TouchEvent) => {
      const d = latest.current
      if (d && !d.settling && e.cancelable) e.preventDefault()
    }
    document.addEventListener('touchmove', stopScroll, { passive: false })
    return () => document.removeEventListener('touchmove', stopScroll)
  }, [])

  /** Put the lifted row under the finger at (clientX, clientY), deciding the axis on the first clear move. */
  const moveTo = (clientX: number, clientY: number) => {
    const d = latest.current
    const c = container.current
    if (!d || !c || d.settling) return
    let axis = d.axis
    if (!axis) {
      const dx = clientX - startClient.current.x
      const dyRaw = clientY - startClient.current.y
      if (Math.hypot(dx, dyRaw) < SLOP) return
      if (Math.abs(dx) > Math.abs(dyRaw) * 1.5) return update(null) // a swipe: not ours
      axis = 'y'
    }
    // Container-relative, so scrolling the page under the finger moves the row with it.
    const fingerY = clientY - c.getBoundingClientRect().top
    const me = d.slots[d.from]
    const first = d.slots[0]
    const last = d.slots[d.slots.length - 1]
    const dy = Math.min(last.top + last.height - (me.top + me.height), Math.max(first.top - me.top, fingerY - startY.current))
    const centre = me.top + me.height / 2 + dy
    const to = d.slots.filter((s, i) => i !== d.from && s.top + s.height / 2 < centre).length
    update({ ...d, axis, dy, to })
  }

  useEffect(() => {
    if (!active) return
    const onPointerMove = (e: PointerEvent) => { if (e.pointerType !== 'touch') { finger.current = { x: e.clientX, y: e.clientY }; moveTo(e.clientX, e.clientY) } }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      finger.current = { x: t.clientX, y: t.clientY }
      moveTo(t.clientX, t.clientY)
    }
    const onEnd = () => drop()
    // iOS reports a cancel when it starts to scroll; with the move cancelled above that no longer
    // happens, and a stray cancel must not drop the row mid-air.
    const onPointerCancel = (e: PointerEvent) => { if (e.pointerType !== 'touch') update(null) }
    const stopMenu = (e: Event) => e.preventDefault()
    // Like a list in UIKit: holding the row near the top or bottom of the screen scrolls the page.
    const EDGE = 90
    const scroller = window.setInterval(() => {
      const f = finger.current
      const d = latest.current
      if (!f || !d || d.axis !== 'y' || d.settling) return
      const h = window.innerHeight
      const step = f.y < EDGE ? -Math.ceil((EDGE - f.y) / 6) : f.y > h - EDGE ? Math.ceil((f.y - (h - EDGE)) / 6) : 0
      if (!step) return
      const before = window.scrollY
      window.scrollBy(0, step)
      if (window.scrollY !== before) moveTo(f.x, f.y)
    }, 16)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onPointerCancel)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    document.addEventListener('contextmenu', stopMenu)
    return () => {
      window.clearInterval(scroller)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onEnd)
      document.removeEventListener('pointercancel', onPointerCancel)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
      document.removeEventListener('contextmenu', stopMenu)
    }
  }, [active])

  const ease = live?.reduced ? 'none' : `transform ${SHIFT_MS}ms var(--ease-out)`

  /** Inline transform for row `i`: the lifted row follows the finger, the rows it passes make room. */
  const styleFor = (i: number): CSSProperties | undefined => {
    if (!live) return undefined
    if (i === live.from) {
      return { transform: `translateY(${live.dy}px) scale(${live.settling ? 1 : 1.02})`, transition: live.settling ? ease : 'none', position: 'relative', zIndex: 10 }
    }
    let shift = 0
    if (live.axis === 'y') {
      if (live.from < i && i <= live.to) shift = -live.slots[live.from].height
      else if (live.to <= i && i < live.from) shift = live.slots[live.from].height
    }
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: ease }
  }

  return {
    containerRef: container,
    /** Ref for the element whose height is one row's pitch, keyed by the row's id. */
    slotRef: (id: string) => (el: HTMLElement | null) => {
      if (el) slotEls.current.set(id, el)
      else slotEls.current.delete(id)
    },
    lift,
    styleFor,
    /** Index of the row being held, if any. */
    lifted: live ? live.from : null,
  }
}

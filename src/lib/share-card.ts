import type { WorkoutDetail } from '../api/types'
import { counts } from './prs'
import { formatSessionLength } from './duration'
import { cardioSetText, strengthSetText, unitsUsed, whenText } from './share-workout'
import { WEB_URL } from './site'
import { convert, type Unit } from './units'

/**
 * The picture of a workout: a 1080 × 1350 card (4:5, what Instagram and Messages show best)
 * drawn on an offscreen canvas in the colours of the theme in use. Title and date at the top,
 * one block per exercise with its sets, a totals row, and the SplitLog mark at the foot.
 * When the exercises do not fit, the type is scaled down once, then the list is cut with
 * "+ n more".
 */

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

export interface CardSet {
  text: string
  pr: boolean
}

export interface CardBlock {
  name: string
  sets: CardSet[]
  /** The same sets with arrows instead of "then", for when the words do not fit. */
  tight: CardSet[]
}

export interface CardContent {
  title: string
  subtitle: string
  blocks: CardBlock[]
  /** "23 sets · 12,480 lb", or just the sets for cardio days. */
  totals: string
}

export interface CardOptions {
  prs?: Set<string>
  now?: Date
}

/** The words on the card, before any measuring: testable without a canvas. */
export function cardContent(w: WorkoutDetail, options: CardOptions = {}): CardContent {
  const now = options.now ?? new Date()
  const prs = options.prs ?? new Set<string>()
  const units = unitsUsed(w)
  const main: Unit | null = units[0] ?? null
  const title = w.title || 'Workout'
  const blocks: CardBlock[] = w.exercises.map((we) => {
    const one = (then: string): CardSet[] =>
      we.kind === 'cardio'
        ? we.sets.map((s) => ({ text: cardioSetText(we, s), pr: false }))
        : we.sets.map((s) => ({ text: strengthSetText(s, s.weight > 0 && s.unit !== main ? s.unit : null, false, then), pr: prs.has(s.id) }))
    return { name: we.name, sets: one(', then '), tight: one(' → ') }
  })
  let volume = 0
  let setCount = 0
  for (const we of w.exercises) {
    for (const s of we.sets) {
      setCount++
      if (!main || !counts({ reps: s.reps, set_type: s.set_type, exercise_kind: we.kind })) continue
      volume += convert(s.weight, s.unit, main) * s.reps
      for (const d of s.drops) volume += convert(d.weight, s.unit, main) * d.reps
    }
  }
  const totals = [`${setCount} set${setCount === 1 ? '' : 's'}`]
  if (main && volume > 0) totals.push(`${Math.round(volume).toLocaleString('en-US')} ${main}`)
  if (prs.size) totals.push(`${prs.size} PR${prs.size === 1 ? '' : 's'}`)
  const length = w.is_plan ? null : formatSessionLength(w)
  const subtitle = [whenText(w, now), ...(length ? [length] : [])].join(' · ')
  return { title, subtitle, blocks, totals: totals.join(' · ') }
}

/* ---- Drawing ---- */

interface Colours {
  bg: string
  surface: string
  accent: string
  text: string
  muted: string
  border: string
  pr: string
  prInk: string
}

/** The theme's colours, read from the custom properties on <html>. */
export function cardColours(): Colours {
  const cs = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    bg: get('--color-bg', '#0b0d10'),
    surface: get('--color-surface', '#15181d'),
    accent: get('--color-accent', '#c6f135'),
    text: get('--color-text', '#f2f4f7'),
    muted: get('--color-muted', '#8b93a1'),
    border: get('--color-border', '#262b33'),
    pr: get('--color-pr', '#ffb020'),
    prInk: '#1a1200',
  }
}

const FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif'
const font = (weight: number, px: number) => `${weight} ${Math.round(px)}px ${FAMILY}`

const PAD = 80
const SEPARATOR = '   ·   '
const CROWN = 'M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z'

interface Metrics {
  name: number
  set: number
  setLine: number
  blockGap: number
  tag: number
}

function metricsAt(scale: number): Metrics {
  return { name: 44 * scale, set: 38 * scale, setLine: 52 * scale, blockGap: 36 * scale, tag: 40 * scale }
}

interface Line {
  items: { text: string; pr: boolean; x: number }[]
}

interface LaidBlock {
  name: string
  lines: Line[]
  height: number
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Cut text with an ellipsis until it fits `width` in the current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1).trimEnd()
  return `${t}…`
}

const MAX_LINES = 3

/** Greedy wrap of a block's sets into at most MAX_LINES lines; the PR tag counts toward the width. */
function layoutSets(ctx: CanvasRenderingContext2D, sets: CardSet[], m: Metrics, width: number): Line[] | null {
  ctx.font = font(500, m.set)
  const sep = ctx.measureText(SEPARATOR).width
  const tagWidth = m.tag * 1.9 + m.set * 0.3
  const lines: Line[] = [{ items: [] }]
  let x = 0
  for (const s of sets) {
    const w = ctx.measureText(s.text).width + (s.pr ? tagWidth : 0)
    const need = (x ? sep : 0) + w
    if (x && x + need > width) {
      if (lines.length === MAX_LINES) return null
      lines.push({ items: [] })
      x = 0
    }
    const line = lines[lines.length - 1]
    line.items.push({ text: s.text, pr: s.pr, x: x ? x + sep : 0 })
    x = (x ? x + sep : 0) + w
  }
  return lines
}

function layoutBlock(ctx: CanvasRenderingContext2D, b: CardBlock, m: Metrics, width: number): LaidBlock {
  let lines = layoutSets(ctx, b.sets, m, width) ?? layoutSets(ctx, b.tight, m, width)
  if (!lines) {
    // Even arrows need more lines than allowed: keep what fits and say the rest is cut.
    const tight = [...b.tight]
    while (tight.length > 1) {
      tight.pop()
      lines = layoutSets(ctx, [...tight, { text: '…', pr: false }], m, width)
      if (lines) break
    }
    lines ??= [{ items: [{ text: fit(ctx, b.tight[0]?.text ?? '', width), pr: false, x: 0 }] }]
  }
  const setLines = b.sets.length ? lines.length : 0
  return { name: b.name, lines: setLines ? lines : [], height: m.name * 1.15 + (setLines ? 10 + setLines * m.setLine : 0) }
}

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, m: Metrics, c: Colours) {
  const h = m.tag
  const w = h * 1.9
  const top = y - h * 0.88
  ctx.fillStyle = c.pr
  roundRect(ctx, x, top, w, h, h * 0.28)
  ctx.fill()
  ctx.save()
  ctx.translate(x + h * 0.2, top + h * 0.17)
  const k = (h * 0.66) / 24
  ctx.scale(k, k)
  ctx.fillStyle = c.prInk
  ctx.fill(new Path2D(CROWN))
  ctx.restore()
  ctx.fillStyle = c.prInk
  ctx.font = font(800, h * 0.64)
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('PR', x + h * 0.92, top + h * 0.74)
}

/** The three bars of the app icon, in a box `size` high at (x, y). */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colour: string) {
  ctx.fillStyle = colour
  const bar = size * 0.075
  // Three barbells, rows a third of the box apart; plates shorter than that so rows stay apart.
  const rows: [number, number[]][] = [
    [0.17, [0.2, 0.28]],
    [0.5, [0.22]],
    [0.83, [0.15]],
  ]
  for (const [cy, plates] of rows) {
    const yy = y + cy * size
    roundRect(ctx, x, yy - bar / 2, size, bar, bar / 2)
    ctx.fill()
    plates.forEach((ph, i) => {
      const pw = size * 0.09
      const h = ph * size
      const left = x + size * 0.13 + i * (pw + size * 0.015)
      roundRect(ctx, left, yy - h / 2, pw, h, pw * 0.3)
      ctx.fill()
      roundRect(ctx, 2 * x + size - left - pw, yy - h / 2, pw, h, pw * 0.3)
      ctx.fill()
    })
  }
}

/** Draw the card onto a canvas; exported so a preview can reuse it. */
export function drawWorkoutCard(canvas: HTMLCanvasElement, content: CardContent, c: Colours): void {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas')
  const W = CARD_WIDTH
  const H = CARD_HEIGHT
  const inner = W - PAD * 2

  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // Header: title shrinks until it fits on one line.
  let titlePx = 92
  ctx.font = font(800, titlePx)
  while (ctx.measureText(content.title).width > inner && titlePx > 56) {
    titlePx -= 4
    ctx.font = font(800, titlePx)
  }
  let y = PAD + titlePx * 0.82
  ctx.fillStyle = c.text
  ctx.fillText(fit(ctx, content.title, inner), PAD, y)
  y += 60
  ctx.font = font(500, 38)
  ctx.fillStyle = c.muted
  ctx.fillText(fit(ctx, content.subtitle, inner), PAD, y)
  y += 40
  ctx.fillStyle = c.accent
  roundRect(ctx, PAD, y, 96, 10, 5)
  ctx.fill()
  y += 44

  // Footer: the mark and the address sit on the bottom edge; the panel may not reach them.
  const markSize = 52
  const footerY = H - PAD - markSize
  let panelTop = y
  const panelMaxBottom = footerY - 44
  const panelPad = 44
  const panelInner = inner - panelPad * 2

  // A short workout gets larger type; a long one is laid out at full size, then smaller, step by
  // step. When the smallest type still overflows, the list is cut with "+ n more".
  let m = metricsAt(1)
  let laid: LaidBlock[] = []
  let shown = content.blocks.length
  const totalsHeight = (mm: Metrics) => mm.set * 1.2 + 36
  const heightOf = (blocks: LaidBlock[], mm: Metrics, more: boolean, totals: boolean) =>
    panelPad * 2 + blocks.reduce((h, b) => h + b.height, 0) + Math.max(0, blocks.length - 1) * mm.blockGap + (more ? mm.set * 1.3 + mm.blockGap : 0) + (totals ? totalsHeight(mm) : 0)
  const room = panelMaxBottom - panelTop
  for (const scale of [1.2, 1.1, 1, 0.9, 0.8, 0.72]) {
    m = metricsAt(scale)
    laid = content.blocks.map((b) => layoutBlock(ctx, b, m, panelInner))
    if (heightOf(laid, m, false, true) <= room) break
  }
  let withTotals = true
  if (heightOf(laid, m, false, true) > room) {
    shown = laid.length
    while (shown > 1 && heightOf(laid.slice(0, shown), m, true, true) > room) shown--
    if (heightOf(laid.slice(0, shown), m, true, true) > room) withTotals = false
  }
  const visible = laid.slice(0, shown)
  const more = content.blocks.length - shown
  const panelHeight = heightOf(visible, m, more > 0, withTotals)
  // Room to spare goes mostly below the panel, a little above, so the card does not sit top-heavy.
  panelTop += Math.max(0, room - panelHeight) * 0.3

  ctx.fillStyle = c.surface
  roundRect(ctx, PAD, panelTop, inner, panelHeight, 36)
  ctx.fill()
  ctx.strokeStyle = c.border
  ctx.lineWidth = 2
  ctx.stroke()

  let by = panelTop + panelPad
  const bx = PAD + panelPad
  visible.forEach((b, i) => {
    if (i > 0) {
      by += m.blockGap / 2
      ctx.strokeStyle = c.border
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(bx, by - m.blockGap / 2)
      ctx.lineTo(bx + panelInner, by - m.blockGap / 2)
      ctx.stroke()
      by += m.blockGap / 2
    }
    ctx.font = font(700, m.name)
    ctx.fillStyle = c.text
    ctx.fillText(fit(ctx, b.name, panelInner), bx, by + m.name * 0.85)
    let ly = by + m.name * 1.15 + 10
    for (const line of b.lines) {
      const baseline = ly + m.setLine * 0.72
      for (const it of line.items) {
        ctx.font = font(500, m.set)
        ctx.fillStyle = c.muted
        ctx.fillText(it.text, bx + it.x, baseline)
        if (it.pr) drawTag(ctx, bx + it.x + ctx.measureText(it.text).width + m.set * 0.3, baseline, m, c)
      }
      ly += m.setLine
    }
    by += b.height
  })
  if (more > 0) {
    by += m.blockGap
    ctx.font = font(500, m.set)
    ctx.fillStyle = c.muted
    ctx.fillText(`+ ${more} more`, bx, by + m.set * 0.85)
    by += m.set * 1.3
  }
  if (withTotals) {
    by += 36
    ctx.strokeStyle = c.border
    ctx.beginPath()
    ctx.moveTo(bx, by - 18)
    ctx.lineTo(bx + panelInner, by - 18)
    ctx.stroke()
    ctx.font = font(700, m.set)
    ctx.fillStyle = c.text
    ctx.fillText(content.totals, bx, by + m.set * 0.9)
  }

  // Footer
  drawMark(ctx, PAD, footerY, markSize, c.accent)
  ctx.font = font(800, 40)
  ctx.fillStyle = c.text
  ctx.fillText('SplitLog', PAD + markSize + 22, footerY + markSize * 0.76)
  ctx.font = font(500, 30)
  ctx.fillStyle = c.muted
  const site = WEB_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
  ctx.fillText(site, W - PAD - ctx.measureText(site).width, footerY + markSize * 0.74)
}

/** The finished card as a PNG. */
export async function renderWorkoutCard(w: WorkoutDetail, options: CardOptions = {}): Promise<Blob> {
  const canvas = document.createElement('canvas')
  drawWorkoutCard(canvas, cardContent(w, options), cardColours())
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the card.'))), 'image/png')
  })
}

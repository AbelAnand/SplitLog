import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { THEMES, darkClock } from './theme'

/*
 * Android system bars. Capacitor's SystemBars plugin draws the web view edge to edge; this keeps
 * the status bar and gesture bar icons readable for the chosen theme. theme.ts already sets the
 * status bar through the StatusBar plugin on both platforms; the gesture bar is Android's alone.
 *
 * The background is read from `--color-bg` on <html> (built-in themes set it through `data-theme`,
 * custom themes as an inline property), so this needs nothing from React.
 */

function styleFor(root: HTMLElement): SystemBarsStyle {
  const bg = getComputedStyle(root).getPropertyValue('--color-bg').trim()
  if (bg) return darkClock(bg) ? SystemBarsStyle.Light : SystemBarsStyle.Dark
  const meta = THEMES.find((t) => t.id === (root.dataset.theme ?? 'volt'))
  // Style.Light means light bars with dark icons.
  return meta?.light ? SystemBarsStyle.Light : SystemBarsStyle.Dark
}

export function installAndroidBars(): void {
  const root = document.documentElement
  const apply = () => { SystemBars.setStyle({ style: styleFor(root) }).catch(() => {}) }
  apply()
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] })
}

import type { ShareResult } from './csv'
import { isAndroid, isNative } from './native'

/**
 * Handing one thing to another app: a piece of text, or a binary file such as a PNG. Each goes
 * to the share sheet on its own (a file plus a message arrives in Messages as an attachment and
 * a wall of text, which is what sharing used to do). Text files go through csv.ts.
 *
 * Android keeps the shared copy in cache/shared/ until the next share replaces it, for the reason
 * given in share-android.ts: the share resolves before the chosen app has necessarily read it.
 * iPhone deletes the copy as soon as the sheet is done with it.
 */

const ANDROID_FOLDER = 'shared'

function cancelled(e: unknown): boolean {
  const err = e as { message?: string; name?: string } | null
  return err?.name === 'AbortError' || /cancel/i.test(err?.message ?? '')
}

export type TextShareResult = ShareResult | 'copied'

/**
 * Share plain text. Phone: the share sheet with just the text. Browser: the Web Share API when
 * there is one, otherwise the text is copied to the clipboard.
 */
export async function shareText(text: string, title: string): Promise<TextShareResult> {
  if (isNative) {
    const { Share } = await import('@capacitor/share')
    try {
      await Share.share({ title, text, dialogTitle: title })
      return 'shared'
    } catch (e) {
      if (cancelled(e)) return 'cancelled'
      throw e
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ text, title })
      return 'shared'
    } catch (e) {
      if (cancelled(e)) return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}

/** The base64 payload of a blob, without the data-URL prefix. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'))
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Hand a binary file (a PNG, say) to the person. Phone: written to the cache and shared as a
 * file. Browser: the Web Share API where it can carry files, otherwise a download.
 */
export async function shareBinaryFile(filename: string, blob: Blob): Promise<ShareResult> {
  if (isNative) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const data = await blobToBase64(blob)
    // No encoding means the data is base64, which is how binary files are written.
    const path = isAndroid ? `${ANDROID_FOLDER}/${filename}` : filename
    if (isAndroid) await Filesystem.rmdir({ path: ANDROID_FOLDER, directory: Directory.Cache, recursive: true }).catch(() => {})
    const written = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: isAndroid })
    try {
      await Share.share({ title: filename, url: written.uri })
      return 'shared'
    } catch (e) {
      if (cancelled(e)) return 'cancelled'
      throw e
    } finally {
      if (!isAndroid) Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {})
    }
  }
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (cancelled(e)) return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

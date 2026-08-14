import type { ReactNode } from 'react'

/**
 * Wrap digit runs (including odds like 1/512) in Plex Mono without touching
 * the surrounding prose.
 */
export function withNums(text: string): ReactNode {
  const parts = text.split(/(\d+(?:\/\d+)?(?:\.\d+)?)/g)
  return parts.map((part, index) =>
    /^\d/.test(part) ? (
      <span key={index} className="num">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

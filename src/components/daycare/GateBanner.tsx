import type { FeatureGate } from '../../data/schema'

/**
 * Enums select which sentence to write — they never appear in the sentence.
 * Unknown features fall back to player language, not the raw id.
 */
function gateCopy(feature: string): { noun: string; collapsed: string } {
  switch (feature) {
    case 'daycare':
      return {
        noun: 'Day Care',
        collapsed: 'Day Care unlocks after completing certain points of the story — tap to expand',
      }
    case 'move-reminder':
      return {
        noun: 'Move Reminder',
        collapsed: 'Move Reminder unlocks later — tap to expand',
      }
    case 'hidden-ability-access':
      return {
        noun: 'hidden-ability access',
        collapsed: 'Hidden abilities unlock later — tap to expand',
      }
    default:
      return {
        noun: 'feature',
        collapsed: 'A feature unlocks later — tap to expand',
      }
  }
}

export function gateStorageKey(gameId: string, feature: string): string {
  return `${gameId}:${feature}`
}

export type GateDismissals = Record<string, boolean>

type GateBannerProps = {
  gameId: string
  gates: FeatureGate[]
  dismissed: GateDismissals
  onDismissedChange: (next: GateDismissals) => void
}

/**
 * Temporal feature-gate banner. Dismisses to a chip (not a modal).
 * Dismissal state is owned by the parent so desktop/mobile placements stay in sync.
 * Copy stays in player language — never surface schema names like "feature gate".
 */
export default function GateBanner({
  gameId,
  gates,
  dismissed,
  onDismissedChange,
}: GateBannerProps) {
  if (gates.length === 0) return null

  function dismiss(feature: string) {
    onDismissedChange({
      ...dismissed,
      [gateStorageKey(gameId, feature)]: true,
    })
  }

  function restore(feature: string) {
    const next = { ...dismissed }
    delete next[gateStorageKey(gameId, feature)]
    onDismissedChange(next)
  }

  return (
    <div className="min-w-0 space-y-2">
      {gates.map((gate) => {
        const key = gateStorageKey(gameId, gate.feature)
        const isDismissed = Boolean(dismissed[key])
        const copy = gateCopy(gate.feature)

        if (isDismissed) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => restore(gate.feature)}
              className="max-w-full rounded border border-brass px-2 py-1 text-left text-meta text-brass hover:bg-raised"
            >
              {copy.collapsed}
            </button>
          )
        }

        return (
          <div
            key={key}
            role="status"
            className="min-w-0 rounded border border-brass bg-raised px-3 py-3"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <p className="min-w-0 flex-1 break-words text-sm text-bright">
                The {copy.noun} in this game unlocks after:{' '}
                {gate.unlockedAfter}
              </p>
              <button
                type="button"
                onClick={() => dismiss(gate.feature)}
                className="shrink-0 self-start text-sm text-muted hover:text-bright"
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import type { FeatureGate } from '../../data/schema'

function collapsedChip(noun: string): string {
  return `${noun} unlocks after completing certain points of the story — tap to expand`
}

export function gateStorageKey(gameId: string, gateId: string): string {
  return `${gameId}:${gateId}`
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

  function dismiss(gateId: string) {
    onDismissedChange({
      ...dismissed,
      [gateStorageKey(gameId, gateId)]: true,
    })
  }

  function restore(gateId: string) {
    const next = { ...dismissed }
    delete next[gateStorageKey(gameId, gateId)]
    onDismissedChange(next)
  }

  return (
    <div className="min-w-0 space-y-2">
      {gates.map((gate) => {
        const key = gateStorageKey(gameId, gate.id)
        const isDismissed = Boolean(dismissed[key])

        if (isDismissed) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => restore(gate.id)}
              className="max-w-full rounded border border-brass px-2 py-1 text-left text-meta text-brass hover:bg-raised"
            >
              {collapsedChip(gate.noun)}
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
                The {gate.noun} in this game unlocks after:{' '}
                {gate.unlockedAfter}
              </p>
              <button
                type="button"
                onClick={() => dismiss(gate.id)}
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

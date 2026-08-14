import { useEffect, useState } from 'react'
import type { FeatureGate } from '../../data/schema'
import { getJson, setJson } from '../../lib/storage'

const GATES_KEY = 'pokemon:gates:v1'

type GateDismissals = Record<string, boolean>

function gateKey(gameId: string, feature: string): string {
  return `${gameId}:${feature}`
}

/**
 * Enums select which sentence to write — they never appear in the sentence.
 * Unknown features fall back to player language, not the raw id.
 */
function gateCopy(feature: string): { noun: string; collapsed: string } {
  switch (feature) {
    case 'daycare':
      return {
        noun: 'Day Care',
        collapsed: 'Day Care unlocks later — tap to expand',
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

type GateBannerProps = {
  gameId: string
  gates: FeatureGate[]
}

/**
 * Temporal feature-gate banner. Dismisses to a chip (not a modal); dismissal is
 * remembered per game+gate under the pokemon: localStorage prefix.
 */
export default function GateBanner({ gameId, gates }: GateBannerProps) {
  const [dismissed, setDismissed] = useState<GateDismissals>({})

  useEffect(() => {
    setDismissed(getJson<GateDismissals>(GATES_KEY) ?? {})
  }, [])

  if (gates.length === 0) return null

  function dismiss(feature: string) {
    const next = { ...dismissed, [gateKey(gameId, feature)]: true }
    setDismissed(next)
    setJson(GATES_KEY, next)
  }

  function restore(feature: string) {
    const next = { ...dismissed }
    delete next[gateKey(gameId, feature)]
    setDismissed(next)
    setJson(GATES_KEY, next)
  }

  return (
    <div className="mb-6 space-y-2">
      {gates.map((gate) => {
        const key = gateKey(gameId, gate.feature)
        const isDismissed = Boolean(dismissed[key])
        const copy = gateCopy(gate.feature)

        if (isDismissed) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => restore(gate.feature)}
              className="rounded border border-brass px-2 py-1 text-caption text-brass hover:bg-raised"
            >
              {copy.collapsed}
            </button>
          )
        }

        return (
          <div
            key={key}
            role="status"
            className="rounded border border-brass bg-raised px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brass">
                  Warning · feature gate
                </p>
                <p className="mt-1 text-sm text-bright">
                  The {copy.noun} in this game unlocks after:{' '}
                  {gate.unlockedAfter}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(gate.feature)}
                className="shrink-0 text-sm text-muted hover:text-bright"
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

import type { Ruleset } from '../../data/schema'
import {
  eggAffectingHeldItemsExist,
  type PairingStrategy,
  type ParentRequirement,
} from '../../engine/daycareEngine'
import RuleFlag from './RuleFlag'

type ParentPairCardProps = {
  strategies: PairingStrategy[]
  selectedStrategyId: string
  routesEquivalent?: boolean
  excludedStrategies?: Array<{ id: string; label: string; reason: string }>
  ruleset: Ruleset
  onSelectStrategy: (id: string) => void
  ownedRoles: Set<string>
  onToggleOwned: (role: 'A' | 'B') => void
}

function ParentBlock({
  parent,
  owned,
  showHeldItems,
  onToggleOwned,
}: {
  parent: ParentRequirement
  owned: boolean
  showHeldItems: boolean
  onToggleOwned: () => void
}) {
  const acquisition = parent.acquisition ?? []

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-bright">
            Parent {parent.role}
          </h4>
          <p className="mt-1 text-sm text-body">
            {parent.gender ? `${parent.gender} ` : null}
            {parent.species.join(' / ')}
          </p>
          {parent.genderReason ? (
            <p className="mt-1 text-caption text-muted">{parent.genderReason}</p>
          ) : null}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-caption text-body">
          <input
            type="checkbox"
            checked={owned}
            onChange={onToggleOwned}
          />
          I already have this
        </label>
      </div>

      {!owned && acquisition.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-caption font-medium uppercase tracking-wide text-muted">
            Get this parent first
          </p>
          {acquisition.map((flag, index) => (
            <RuleFlag
              key={`${parent.role}-acq-${flag.severity}-${index}`}
              flag={flag}
            />
          ))}
        </div>
      ) : null}

      <ul className="mt-3 list-none space-y-1 p-0 text-sm text-body">
        {parent.mustHaveNature ? (
          <li>Nature: {parent.mustHaveNature}</li>
        ) : null}
        {parent.mustHaveAbility ? (
          <li>Ability: {parent.mustHaveAbility}</li>
        ) : null}
        {parent.mustKnow && parent.mustKnow.length > 0 ? (
          <li>Must know: {parent.mustKnow.join(', ')}</li>
        ) : null}
      </ul>

      {showHeldItems ? (
        <div className={owned ? 'mt-3' : 'mt-2'}>
          {parent.heldItem ? (
            <div className="text-sm">
              <p className="text-bright">
                Held item: {parent.heldItem}
                {!owned ? (
                  <span className="text-muted"> — after you have this parent</span>
                ) : null}
              </p>
              {parent.heldItemReason ? (
                <p className="mt-1 text-caption text-muted">
                  {parent.heldItemReason}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">Held item: (open slot)</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function ParentPairCard({
  strategies,
  selectedStrategyId,
  routesEquivalent = false,
  excludedStrategies = [],
  ruleset,
  onSelectStrategy,
  ownedRoles,
  onToggleOwned,
}: ParentPairCardProps) {
  if (strategies.length === 0) return null

  const selected =
    strategies.find((strategy) => strategy.id === selectedStrategyId) ??
    strategies[0]
  const showHeldItems = eggAffectingHeldItemsExist(ruleset)

  return (
    <section className="space-y-3">
      <h2 className="text-title font-medium text-bright">What you need</h2>
      <p className="text-sm text-muted">
        {showHeldItems
          ? 'Pick a route by what you have to acquire — held items, pairing, and hatching are the same either way.'
          : 'Pick a route by what you have to acquire — pairing and hatching are the same either way.'}
      </p>

      <div
        className={
          strategies.length > 1
            ? 'grid grid-cols-1 gap-2 sm:grid-cols-2'
            : 'grid grid-cols-1 gap-2'
        }
        role="radiogroup"
        aria-label="Pairing routes"
      >
        {strategies.map((strategy) => {
          const isSelected = strategy.id === selected?.id
          return (
            <button
              key={strategy.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectStrategy(strategy.id)}
              className={
                isSelected
                  ? 'rounded border border-accent bg-page px-3 py-3 text-left'
                  : 'rounded border border-edge bg-page px-3 py-3 text-left hover:border-bright'
              }
            >
              <p className="text-sm font-medium text-bright">{strategy.label}</p>
              <p className="mt-1 text-sm text-body">{strategy.acquisitionCost}</p>
              {strategy.recommended && strategy.recommendReason ? (
                <p className="mt-2 text-caption text-muted">
                  Recommended — {strategy.recommendReason.toLowerCase()}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>

      {routesEquivalent && strategies.length > 1 ? (
        <p className="text-sm text-muted">
          These routes are equivalent — same number of parents to obtain.
        </p>
      ) : null}

      {excludedStrategies.map((excluded) => (
        <p key={excluded.id} className="text-sm text-muted">
          {excluded.label} isn&apos;t available — {excluded.reason}
        </p>
      ))}

      {selected ? (
        <div className="space-y-3 border-t border-edge pt-4">
          <h3 className="text-sm font-medium text-bright">
            Parents for {selected.label}
          </h3>
          {!showHeldItems ? (
            <p className="text-sm text-body">
              No held item affects egg outcomes in this game.
            </p>
          ) : null}
          <div className="divide-y divide-edge border-t border-edge">
            {selected.parents.map((parent) => (
              <div key={`${selected.id}-${parent.role}`} className="py-4">
                <ParentBlock
                  parent={parent}
                  owned={ownedRoles.has(parent.role)}
                  showHeldItems={showHeldItems}
                  onToggleOwned={() => onToggleOwned(parent.role)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

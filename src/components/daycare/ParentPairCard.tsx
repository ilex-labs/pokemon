import type { Ruleset } from '../../data/schema'
import {
  chooserComparisonCopy,
  eggAffectingHeldItemsExist,
  type PairingStrategy,
  type ParentRequirement,
  type RoutePairComparison,
} from '../../engine/daycareEngine'
import { withNums } from '../../lib/withNums'
import { formatReason, formatReasons, type Reason } from '../../lib/reason'
import RuleFlag from './RuleFlag'

type ParentPairCardProps = {
  strategies: PairingStrategy[]
  selectedStrategyId: string
  routeComparisons?: RoutePairComparison[]
  excludedStrategies?: Array<{ id: string; label: string; reason: Reason }>
  ruleset: Ruleset
  onSelectStrategy: (id: string) => void
  ownedRoles: Set<string>
  onToggleOwned: (role: 'A' | 'B') => void
  hatchOutcome?: string | null
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
          <h4 className="label-caps">Parent {parent.role}</h4>
          <p className="mt-1.5 text-item font-medium text-bright">
            {parent.gender ? `${parent.gender} ` : null}
            {parent.species.join(' / ')}
          </p>
          {parent.genderReason && parent.genderReason.length > 0 ? (
            <p className="mt-1 text-meta text-muted">
              {withNums(formatReasons(parent.genderReason))}
            </p>
          ) : null}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-meta text-body">
          <input
            type="checkbox"
            checked={owned}
            onChange={onToggleOwned}
          />
          I already have this
        </label>
      </div>

      {!owned && acquisition.length > 0 ? (
        <div className="mt-[var(--spacing-within)] space-y-2">
          <p className="label-caps">Get this parent first</p>
          {acquisition.map((flag, index) => (
            <RuleFlag
              key={`${parent.role}-acq-${flag.severity}-${index}`}
              flag={flag}
            />
          ))}
        </div>
      ) : null}

      <ul className="mt-[var(--spacing-within)] list-none space-y-1 p-0 text-sm text-body">
        {parent.mustHaveNature ? (
          <li>Nature: {parent.mustHaveNature}</li>
        ) : null}
        {parent.mustHaveAbility ? (
          <li>Ability: {parent.mustHaveAbility}</li>
        ) : null}
        {parent.mustKnow && parent.mustKnow.length > 0 ? (
          <li>Must know: {parent.mustKnow.join(', ')}</li>
        ) : null}
        {parent.mustOriginateFromDifferentLanguage ? (
          <li>Must originate from a different-language game than its partner</li>
        ) : null}
      </ul>

      {showHeldItems && parent.heldItem ? (
        <div className="mt-[var(--spacing-within)] text-sm">
          <p className="text-bright">
            Held item: {parent.heldItem}
            {!owned ? (
              <span className="text-muted"> — after you have this parent</span>
            ) : null}
          </p>
          {parent.heldItemReason && parent.heldItemReason.length > 0 ? (
            <p className="mt-1 text-meta text-muted">
              {withNums(formatReasons(parent.heldItemReason))}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function ParentPairCard({
  strategies,
  selectedStrategyId,
  routeComparisons,
  excludedStrategies = [],
  ruleset,
  onSelectStrategy,
  ownedRoles,
  onToggleOwned,
  hatchOutcome,
}: ParentPairCardProps) {
  if (strategies.length === 0) return null

  const selected =
    strategies.find((strategy) => strategy.id === selectedStrategyId) ??
    strategies[0]
  const showHeldItems = eggAffectingHeldItemsExist(ruleset)
  const recommendReason = strategies.find(
    (strategy) => strategy.recommended && strategy.recommendReason,
  )?.recommendReason
  const followOnReason = strategies.find(
    (strategy) => strategy.requiresRoute,
  )?.requiresRoute?.reason
  const comparisonCopy = chooserComparisonCopy(routeComparisons, strategies)

  return (
    <div className="space-y-[var(--spacing-section)]">
      <section className="space-y-[var(--spacing-within)]">
        <div className="border-b border-edge pb-2">
          <h2 className="text-section font-medium text-bright">Routes</h2>
        </div>
        <p className="text-sm text-muted">
          {showHeldItems
            ? 'Pick a route by what you have to acquire — held items, pairing, and hatching are the same either way.'
            : 'Pick a route by what you have to acquire — pairing and hatching are the same either way.'}
        </p>

        <div
          className={
            strategies.length > 1
              ? 'grid grid-cols-1 items-start gap-2 @[28rem]:grid-cols-2'
              : 'grid grid-cols-1 items-start gap-2'
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
                aria-describedby={
                  strategy.recommended && recommendReason
                    ? 'route-recommend-reason'
                    : strategy.requiresRoute
                      ? 'route-follow-on-reason'
                      : undefined
                }
                onClick={() => onSelectStrategy(strategy.id)}
                className={
                  isSelected
                    ? 'min-w-0 rounded border border-accent bg-page px-3 py-3 text-left'
                    : 'min-w-0 rounded border border-edge bg-page px-3 py-3 text-left hover:border-bright'
                }
              >
                <p className="text-item font-medium text-bright">
                  {strategy.label}
                </p>
                <p className="mt-1 text-sm text-body">
                  {withNums(strategy.acquisitionCost)}
                </p>
                {strategy.recommended ? (
                  <p className="mt-2 text-meta font-medium text-verdigris">
                    Recommended
                  </p>
                ) : null}
                {strategy.requiresRoute ? (
                  <p className="mt-2 text-meta font-medium text-muted">
                    Follow-on
                  </p>
                ) : null}
              </button>
            )
          })}
        </div>

        {recommendReason ? (
          <p id="route-recommend-reason" className="text-meta leading-snug text-muted">
            {formatReason(recommendReason)}
          </p>
        ) : null}

        {followOnReason ? (
          <p id="route-follow-on-reason" className="text-sm text-muted">
            {formatReason(followOnReason)}
          </p>
        ) : null}

        {comparisonCopy?.kind === 'equivalent' ? (
          <p className="text-sm text-muted">
            These routes are equivalent — neither is easier to assemble.
          </p>
        ) : null}

        {comparisonCopy?.kind === 'incomparable' ? (
          <p className="text-sm text-muted">
            {formatReason(comparisonCopy.reason)}
          </p>
        ) : null}

        {excludedStrategies.map((excluded) => (
          <p key={excluded.id} className="text-sm text-muted">
            {excluded.label} isn&apos;t available — {formatReason(excluded.reason)}
          </p>
        ))}
      </section>

      {selected ? (
        <section className="space-y-[var(--spacing-within)]">
          <div className="border-b border-edge pb-2">
            <h2 className="text-section font-medium text-bright">
              What you need
            </h2>
          </div>
          {!showHeldItems ? (
            <p className="text-sm text-body">
              No held item affects egg outcomes in this game.
            </p>
          ) : null}
          <div className="divide-y divide-edge">
            {selected.parents.map((parent) => (
              <div
                key={`${selected.id}-${parent.role}`}
                className="py-[var(--spacing-within)]"
              >
                <ParentBlock
                  parent={parent}
                  owned={ownedRoles.has(parent.role)}
                  showHeldItems={showHeldItems}
                  onToggleOwned={() => onToggleOwned(parent.role)}
                />
              </div>
            ))}
          </div>
          {hatchOutcome ? (
            <p className="text-sm text-body">{withNums(hatchOutcome)}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

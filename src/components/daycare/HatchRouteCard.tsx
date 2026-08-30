import type { AbilityHolder, GameData } from '../../data/schema'
import { buildHatchEfficiency } from '../../engine/hatchRouter'
import { withNums } from '../../lib/withNums'
import HatchModifierExplainer from './HatchModifierExplainer'

type HatchRouteCardProps = {
  game: GameData
}

type HolderEntry = { name: string; where: string }
type HolderGroup = { ability: string; entries: HolderEntry[] }

/**
 * Group holders by each listed ability. A species with two abilities
 * (Carkol: Steam Engine and Flame Body) appears under both headings —
 * deliberate, not a parse of "or".
 */
function groupHoldersByAbility(holders: AbilityHolder[]): HolderGroup[] {
  const order: string[] = []
  const groups = new Map<string, HolderEntry[]>()

  for (const holder of holders) {
    for (const ability of holder.abilities) {
      let entries = groups.get(ability)
      if (!entries) {
        entries = []
        groups.set(ability, entries)
        order.push(ability)
      }
      entries.push({ name: holder.species, where: holder.place })
    }
  }

  return order.map((ability) => ({ ability, entries: groups.get(ability)! }))
}

function HolderLocations({ holders }: { holders: AbilityHolder[] }) {
  const groups = groupHoldersByAbility(holders)

  return (
    <ul className="mt-1.5 list-none space-y-1.5 p-0">
      {groups.map((group) => (
        <li key={group.ability || group.entries.map((e) => e.name).join('/')}>
          {group.ability ? (
            <p className="font-medium text-bright">{group.ability}</p>
          ) : null}
          <ul className="mt-0.5 grid list-none grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 p-0">
            {group.entries.map((entry) => (
              <li
                key={`${group.ability}-${entry.name}-${entry.where}`}
                className="col-span-2 grid grid-cols-subgrid items-baseline"
              >
                <span className="text-body">{entry.name}</span>
                {entry.where ? (
                  <span className="min-w-0 text-muted">
                    {withNums(entry.where)}
                  </span>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function EfficiencyList({
  lines,
  emptyMessage,
}: {
  lines: ReturnType<typeof buildHatchEfficiency>['eggRate']
  emptyMessage: string
}) {
  if (lines.length === 0) {
    return <p className="mt-2">{withNums(emptyMessage)}</p>
  }

  return (
    <ul className="mt-2 list-none space-y-2 p-0">
      {lines.map((line) => (
        <li key={`${line.kind}-${line.name}`}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-bright">{line.name}</span>
            {line.paceLabel ? (
              <span className="text-muted">· {line.paceLabel}</span>
            ) : null}
          </div>
          <p>{withNums(line.effect)}</p>
          {line.availability ? (
            <p className="text-muted">{withNums(line.availability)}</p>
          ) : null}
          {line.exampleHolders && line.exampleHolders.length > 0 ? (
            <HolderLocations holders={line.exampleHolders} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export default function HatchRouteCard({ game }: HatchRouteCardProps) {
  const view = buildHatchEfficiency(game)
  const eggRateEmpty =
    game.noEggRateBoostsReason ??
    'No egg-rate boosts recorded for this game yet.'
  const hatchSpeedEmpty =
    'No hatch-speed shortcuts recorded for this game yet.'

  return (
    <section className="space-y-[var(--spacing-within)]">
      <div className="border-b border-edge pb-2">
        <h2 className="text-item font-medium text-pretty text-bright">
          Hatch efficiency
        </h2>
      </div>

      <div>
        <h3 className="label-caps">Getting eggs faster</h3>
        <EfficiencyList lines={view.eggRate} emptyMessage={eggRateEmpty} />
      </div>

      <div>
        <h3 className="label-caps">Hatching them faster</h3>
        <EfficiencyList lines={view.hatchSpeed} emptyMessage={hatchSpeedEmpty} />
      </div>

      {game.hatchMechanicExplainer ? (
        <HatchModifierExplainer text={game.hatchMechanicExplainer} />
      ) : null}
    </section>
  )
}

import type { GameData } from '../../data/schema'
import { buildHatchEfficiency } from '../../engine/hatchRouter'
import { withNums } from '../../lib/withNums'
import HatchModifierExplainer from './HatchModifierExplainer'

type HatchRouteCardProps = {
  game: GameData
}

type HolderEntry = { name: string; where: string }
type HolderGroup = { ability: string; entries: HolderEntry[] }

/** Split "Species — place (Ability or Other)" into ability groups. */
function groupHoldersByAbility(holders: string[]): HolderGroup[] {
  const order: string[] = []
  const groups = new Map<string, HolderEntry[]>()

  for (const holder of holders) {
    const match = holder.match(/^(.*)\s+\(([^)]+)\)\s*$/)
    const abilities = match
      ? match[2].split(/\s+or\s+/).map((name) => name.trim()).filter(Boolean)
      : ['']
    const body = match ? match[1] : holder
    const dash = body.indexOf(' — ')
    const name = dash === -1 ? body : body.slice(0, dash)
    const where = dash === -1 ? '' : body.slice(dash + 3)

    for (const ability of abilities) {
      let entries = groups.get(ability)
      if (!entries) {
        entries = []
        groups.set(ability, entries)
        order.push(ability)
      }
      entries.push({ name, where })
    }
  }

  return order.map((ability) => ({ ability, entries: groups.get(ability)! }))
}

function HolderLocations({ holders }: { holders: string[] }) {
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

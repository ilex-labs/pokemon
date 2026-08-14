import type { GameData } from '../../data/schema'
import { buildHatchEfficiency } from '../../engine/hatchRouter'
import HatchModifierExplainer from './HatchModifierExplainer'

type HatchRouteCardProps = {
  game: GameData
}

function EfficiencyList({
  lines,
  emptyMessage,
}: {
  lines: ReturnType<typeof buildHatchEfficiency>['eggRate']
  emptyMessage: string
}) {
  if (lines.length === 0) {
    return <p className="mt-2 text-sm text-body">{emptyMessage}</p>
  }

  return (
    <ul className="mt-2 list-none space-y-3 p-0">
      {lines.map((line) => (
        <li key={`${line.kind}-${line.name}`} className="text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-bright">{line.name}</span>
            {line.paceLabel ? (
              <span className="text-muted">· {line.paceLabel}</span>
            ) : null}
          </div>
          <p className="text-body">{line.effect}</p>
          {line.availability ? (
            <p className="text-muted">{line.availability}</p>
          ) : null}
          {line.exampleHolders && line.exampleHolders.length > 0 ? (
            <ul className="mt-1 list-none space-y-0.5 p-0 text-sm text-body">
              {line.exampleHolders.map((holder) => (
                <li key={holder}>{holder}</li>
              ))}
            </ul>
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
    <section className="rounded border border-edge bg-surface px-4 py-4">
      <h2 className="text-title font-medium text-bright">Hatch efficiency</h2>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-bright">Getting eggs faster</h3>
        <EfficiencyList lines={view.eggRate} emptyMessage={eggRateEmpty} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-medium text-bright">Hatching them faster</h3>
        <EfficiencyList lines={view.hatchSpeed} emptyMessage={hatchSpeedEmpty} />
      </div>

      {game.hatchMechanicExplainer ? (
        <HatchModifierExplainer text={game.hatchMechanicExplainer} />
      ) : null}
    </section>
  )
}

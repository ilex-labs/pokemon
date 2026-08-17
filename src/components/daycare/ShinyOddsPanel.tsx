import type { ShinyOdds } from '../../engine/daycareEngine'
import { withNums } from '../../lib/withNums'

type ShinyOddsPanelProps = {
  shiny: ShinyOdds
}

export default function ShinyOddsPanel({ shiny }: ShinyOddsPanelProps) {
  return (
    <section className="space-y-[var(--spacing-within)]">
      <div className="border-b border-edge pb-2">
        <h2 className="text-item font-medium text-bismuth">Shiny egg odds</h2>
      </div>
      <p className="border-l-2 border-bismuth py-2 pl-3 text-sm text-bright">
        {withNums(shiny.determinedOnReceive)}
      </p>
      {shiny.noBoostsReason ? (
        <p>{withNums(shiny.noBoostsReason)}</p>
      ) : (
        <p className="text-muted">
          Approximate eggs until a shiny at each tier that applies in this game.
        </p>
      )}
      <ul className="list-none divide-y divide-edge p-0">
        {shiny.tiers.map((tier) => (
          <li key={tier.id} className="py-2">
            <p className="font-medium text-bright">{tier.label}</p>
            <p>
              <span className="num text-bright">{tier.odds}</span>
              <span className="text-muted">
                {' '}
                · ~
                <span className="num">
                  {tier.approximateEggs.toLocaleString()}
                </span>{' '}
                eggs
              </span>
            </p>
            {tier.context ? (
              <p className="mt-1 text-muted">{withNums(tier.context)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

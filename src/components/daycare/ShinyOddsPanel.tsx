import type { ShinyOdds } from '../../engine/daycareEngine'

type ShinyOddsPanelProps = {
  shiny: ShinyOdds
}

export default function ShinyOddsPanel({ shiny }: ShinyOddsPanelProps) {
  return (
    <section className="space-y-[var(--spacing-within)]">
      <div className="border-b border-edge pb-2">
        <h2 className="text-section font-medium text-bright">Shiny egg odds</h2>
      </div>
      <p className="text-sm text-muted">
        Approximate eggs until a shiny at each tier that applies in this game.
      </p>
      <ul className="list-none divide-y divide-edge border-t border-edge p-0">
        {shiny.tiers.map((tier) => (
          <li key={tier.id} className="py-3 text-sm">
            <p className="text-item font-medium text-bright">{tier.label}</p>
            <p className="text-body">
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
          </li>
        ))}
      </ul>
    </section>
  )
}

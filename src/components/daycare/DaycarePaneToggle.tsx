type DaycarePane = 'target' | 'plan'

type DaycarePaneToggleProps = {
  value: DaycarePane
  onChange: (pane: DaycarePane) => void
}

const PANES: Array<{ id: DaycarePane; label: string }> = [
  { id: 'target', label: 'Target' },
  { id: 'plan', label: 'Plan' },
]

/**
 * Narrow-viewport only. Two panes, one tap — nothing collapses.
 * From md the form and plan sit side by side and this is hidden.
 */
export default function DaycarePaneToggle({
  value,
  onChange,
}: DaycarePaneToggleProps) {
  return (
    <div
      className="sticky top-0 z-10 -mx-1 bg-page px-1 py-1.5 md:hidden"
      role="tablist"
      aria-label="Daycare panes"
    >
      <div className="grid grid-cols-2 gap-1 rounded border border-edge bg-surface p-1">
        {PANES.map((pane) => {
          const selected = value === pane.id
          return (
            <button
              key={pane.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`daycare-pane-${pane.id}`}
              onClick={() => onChange(pane.id)}
              className={
                selected
                  ? 'rounded bg-raised px-3 py-2 text-sm font-medium text-bright'
                  : 'rounded px-3 py-2 text-sm font-medium text-muted hover:text-bright'
              }
            >
              {pane.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

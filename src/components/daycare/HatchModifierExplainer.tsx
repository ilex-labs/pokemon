import { withNums } from '../../lib/withNums'

type HatchModifierExplainerProps = {
  text: string
}

/**
 * Inline teaching for how eggs appear and hatch in this game — lives with
 * hatch efficiency, not on a separate guide page.
 */
export default function HatchModifierExplainer({
  text,
}: HatchModifierExplainerProps) {
  if (!text) return null
  return (
    <div className="border-t border-edge pt-[var(--spacing-within)]">
      <h3 className="label-caps">How hatching works here</h3>
      <p className="mt-2">{withNums(text)}</p>
    </div>
  )
}

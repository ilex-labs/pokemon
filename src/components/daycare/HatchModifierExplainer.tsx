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
    <div className="mt-4 border-t border-edge pt-4">
      <h3 className="text-sm font-medium text-bright">How hatching works here</h3>
      <p className="mt-2 text-sm text-body">{text}</p>
    </div>
  )
}

import type { RuleFlag as RuleFlagData } from '../../data/schema'

const SEVERITY_LABEL: Record<RuleFlagData['severity'], string> = {
  info: 'Info',
  warning: 'Warning',
  blocking: 'Blocked',
}

type RuleFlagProps = {
  flag: RuleFlagData
}

/**
 * Severity as a left rule + label — not a filled card.
 * Colour is never the only signal. Blocking keeps a stronger treatment.
 */
export default function RuleFlag({ flag }: RuleFlagProps) {
  if (flag.severity === 'blocking') {
    return (
      <div
        role="status"
        className="mt-2 border-l-2 border-oxide bg-page py-2 pl-3 text-sm text-bright"
      >
        <span className="mr-2 font-medium text-oxide">
          {SEVERITY_LABEL.blocking}
        </span>
        {flag.message}
      </div>
    )
  }

  if (flag.severity === 'warning') {
    return (
      <div
        role="status"
        className="mt-2 border-l-2 border-brass py-1.5 pl-3 text-sm text-body"
      >
        <span className="mr-2 font-medium text-brass">
          {SEVERITY_LABEL.warning}
        </span>
        {flag.message}
      </div>
    )
  }

  return (
    <div
      role="status"
      className="mt-2 border-l-2 border-accent py-1.5 pl-3 text-sm text-body"
    >
      <span className="mr-2 font-medium text-accent">{SEVERITY_LABEL.info}</span>
      {flag.message}
    </div>
  )
}

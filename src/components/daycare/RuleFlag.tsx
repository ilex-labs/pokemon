import type { RuleFlag as RuleFlagData } from '../../data/schema'
import { formatReason } from '../../lib/reason'
import { withNums } from '../../lib/withNums'

const SEVERITY_LABEL: Record<RuleFlagData['severity'], string> = {
  info: 'Info',
  warning: 'Warning',
  blocking: 'Blocked',
}

type RuleFlagProps = {
  flag: RuleFlagData
}

function flagChrome(flag: RuleFlagData): {
  border: string
  labelClass: string
  bodyClass: string
} {
  if (flag.satisfied) {
    return {
      border: 'border-edge',
      labelClass: 'text-muted',
      bodyClass: 'text-muted line-through',
    }
  }
  if (flag.severity === 'blocking') {
    return {
      border: 'border-oxide',
      labelClass: 'text-oxide',
      bodyClass: 'text-bright',
    }
  }
  if (flag.severity === 'warning') {
    return {
      border: 'border-brass',
      labelClass: 'text-brass',
      bodyClass: 'text-body',
    }
  }
  return {
    border: 'border-edge',
    labelClass: 'text-muted',
    bodyClass: 'text-body',
  }
}

/**
 * Severity as a left rule + label — not a filled card.
 * Colour is never the only signal. Blocking keeps a stronger treatment.
 * Satisfied flags stay in the document, struck through and muted.
 */
export default function RuleFlag({ flag }: RuleFlagProps) {
  const chrome = flagChrome(flag)
  const blocking = flag.severity === 'blocking' && !flag.satisfied

  return (
    <div
      role="status"
      className={
        blocking
          ? `mt-2 border-l-2 ${chrome.border} bg-page py-2 pl-3 text-sm ${chrome.bodyClass}`
          : `mt-2 border-l-2 ${chrome.border} py-1.5 pl-3 text-sm ${chrome.bodyClass}`
      }
    >
      <span className={`mr-2 font-medium ${chrome.labelClass}`}>
        {SEVERITY_LABEL[flag.severity]}
      </span>
      {withNums(formatReason(flag))}
    </div>
  )
}

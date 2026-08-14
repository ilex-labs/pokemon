import type { PlanStep } from '../../data/schema'
import RuleFlag from './RuleFlag'

type PlanStepListProps = {
  steps: PlanStep[]
  completedStepIds: string[]
  onToggleStep: (stepId: string) => void
}

export default function PlanStepList({
  steps,
  completedStepIds,
  onToggleStep,
}: PlanStepListProps) {
  const completed = new Set(completedStepIds)

  return (
    <ol className="list-none divide-y divide-edge border-t border-edge p-0">
      {steps.map((step) => {
        const done = completed.has(step.id)
        return (
          <li key={step.id} className="py-3">
            <label className="grid cursor-pointer grid-cols-[2rem_1.25rem_minmax(0,1fr)] gap-x-2">
              <span className="num pt-0.5 text-sm text-muted tabular-nums">
                {step.order}.
              </span>
              <input
                type="checkbox"
                className="mt-1"
                checked={done}
                onChange={() => onToggleStep(step.id)}
              />
              <span className="min-w-0">
                <span
                  className={
                    done
                      ? 'block text-sm text-muted line-through'
                      : 'block text-sm text-bright'
                  }
                >
                  {step.instruction}
                </span>
                {step.ruleFlags?.map((flag, index) => (
                  <RuleFlag
                    key={`${step.id}-${flag.severity}-${index}`}
                    flag={flag}
                  />
                ))}
              </span>
            </label>
          </li>
        )
      })}
    </ol>
  )
}

import PageTitle from '../components/shared/PageTitle'
import { useEffect, useMemo, useState } from 'react'
import type { PlanStep } from '../data/schema'
import {
  defaultIvSpread,
  filterIvPresets,
  gamesCatalog,
  getGameOption,
  natures,
  sharedIvPresets,
  type GameOption,
} from '../data/loadGame'
import {
  planDaycare,
  stepsForStrategy,
  type DaycareTarget,
} from '../engine/daycareEngine'
import GamePicker from '../components/daycare/GamePicker'
import GateBanner, {
  type GateDismissals,
} from '../components/daycare/GateBanner'
import DaycarePaneToggle from '../components/daycare/DaycarePaneToggle'
import HatchRouteCard from '../components/daycare/HatchRouteCard'
import ParentPairCard from '../components/daycare/ParentPairCard'
import PlanStepList from '../components/daycare/PlanStepList'
import ShinyOddsPanel from '../components/daycare/ShinyOddsPanel'
import TargetSpreadForm from '../components/daycare/TargetSpreadForm'
import { getJson, removeJson, setJson } from '../lib/storage'

const STORAGE_KEY = 'pokemon:daycare:v1'
const GATES_KEY = 'pokemon:gates:v1'

/** Persisted inputs only — plan output is always recomputed from the target. */
type StoredDaycare = {
  gameId: string
  targetSpread: DaycareTarget
  ownedParentRoles: Array<'A' | 'B'>
  completedStepIds: string[]
  selectedStrategyId?: string
}

function isDaycareTarget(value: unknown): value is DaycareTarget {
  if (!value || typeof value !== 'object') return false
  const target = value as Record<string, unknown>
  if (typeof target.species !== 'string') return false
  if (typeof target.nature !== 'string') return false
  if (typeof target.ability !== 'string') return false
  if (!Array.isArray(target.eggMoves)) return false
  if (!target.ivs || typeof target.ivs !== 'object') return false
  if (target.wantsShiny !== undefined && typeof target.wantsShiny !== 'boolean') {
    return false
  }
  if (
    target.wantsPowerItem !== undefined &&
    typeof target.wantsPowerItem !== 'boolean'
  ) {
    return false
  }
  return true
}

/**
 * Fail closed: discard anything that isn't the current inputs-only shape.
 * Old entries that nested a project or stored parents/steps are refused entirely.
 */
function isStoredDaycare(value: unknown): value is StoredDaycare {
  if (!value || typeof value !== 'object') return false
  const stored = value as Record<string, unknown>

  // Pre-restructure / half-plan shapes — never partially restore.
  if (
    'project' in stored ||
    'parents' in stored ||
    'planSteps' in stored ||
    'steps' in stored ||
    'blocked' in stored ||
    'shiny' in stored ||
    'strategies' in stored
  ) {
    return false
  }

  if (typeof stored.gameId !== 'string' || stored.gameId.length === 0) return false
  if (!isDaycareTarget(stored.targetSpread)) return false
  if (!Array.isArray(stored.completedStepIds)) return false
  if (!stored.completedStepIds.every((id) => typeof id === 'string')) return false
  if (!Array.isArray(stored.ownedParentRoles)) return false
  if (
    !stored.ownedParentRoles.every((role) => role === 'A' || role === 'B')
  ) {
    return false
  }
  if (
    stored.selectedStrategyId !== undefined &&
    typeof stored.selectedStrategyId !== 'string'
  ) {
    return false
  }

  return true
}

function readStoredDaycare(): StoredDaycare | null {
  const raw = getJson<unknown>(STORAGE_KEY)
  if (!isStoredDaycare(raw)) {
    if (raw !== null) removeJson(STORAGE_KEY)
    return null
  }
  return raw
}

function createDefaultTarget(option: GameOption): DaycareTarget {
  const speciesNames = Object.keys(option.game.species)
  const species = speciesNames[0] ?? ''
  return {
    species,
    nature: 'any',
    ability: 'any',
    eggMoves: [],
    ivs: defaultIvSpread(),
    wantsShiny: false,
  }
}

function firstBlockingMessage(steps: PlanStep[]): string | null {
  for (const step of steps) {
    const blocking = step.ruleFlags?.find((flag) => flag.severity === 'blocking')
    if (blocking) return blocking.message
  }
  return null
}

export default function Daycare() {
  const initialOption = gamesCatalog[0]!
  const [gameId, setGameId] = useState(initialOption.id)
  const option = getGameOption(gameId) ?? initialOption
  const { game, ruleset } = option

  const [target, setTarget] = useState<DaycareTarget>(() =>
    createDefaultTarget(initialOption),
  )
  const [ownedParentRoles, setOwnedParentRoles] = useState<Array<'A' | 'B'>>([])
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([])
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    null,
  )
  const [hydrated, setHydrated] = useState(false)
  /** Narrow viewports only — desktop shows both panes and ignores this. */
  const [mobilePane, setMobilePane] = useState<'target' | 'plan'>('target')
  const [gateDismissals, setGateDismissals] = useState<GateDismissals>({})

  const ownedSet = useMemo(() => new Set(ownedParentRoles), [ownedParentRoles])

  const ivPresets = useMemo(
    () => filterIvPresets(game.ivPresets ?? sharedIvPresets, game.generation),
    [game],
  )

  const speciesNames = Object.keys(game.species)
  const eggMoveOptions = (game.eggMoves[target.species] ?? []).map(
    (entry) => entry.move,
  )

  // Live plan — pure function of game + ruleset + target; no generate mode.
  const plan = useMemo(
    () => planDaycare(game, ruleset, target),
    [game, ruleset, target],
  )

  const strategies = plan.strategies
  const activeStrategy =
    strategies.find((strategy) => strategy.id === selectedStrategyId) ??
    strategies.find((strategy) => strategy.recommended) ??
    strategies[0]

  const steps = useMemo(() => {
    if (!activeStrategy) return plan.steps
    if (activeStrategy.recommended || strategies.length <= 1) {
      return plan.steps
    }
    return stepsForStrategy(game, ruleset, target, activeStrategy)
  }, [plan, activeStrategy, strategies.length, game, ruleset, target])

  const blocked = plan.blocked
  const shiny = plan.shiny
  const featureGates = plan.featureGates ?? game.featureGates ?? []

  // Keep selection valid when strategies recompute.
  useEffect(() => {
    if (strategies.length === 0) return
    const ids = new Set(strategies.map((strategy) => strategy.id))
    if (selectedStrategyId && ids.has(selectedStrategyId)) return
    const recommended =
      strategies.find((strategy) => strategy.recommended) ?? strategies[0]
    setSelectedStrategyId(recommended?.id ?? null)
  }, [strategies, selectedStrategyId])

  // Drop completed ids that no longer exist after a recompute.
  useEffect(() => {
    const valid = new Set(steps.map((step) => step.id))
    setCompletedStepIds((current) => {
      const next = current.filter((id) => valid.has(id))
      return next.length === current.length ? current : next
    })
  }, [steps])

  // Clear ownership when the target changes enough that parents reshuffle —
  // strategy selection already resets ownership; target edits keep owned roles
  // when the same roles still exist.

  useEffect(() => {
    const saved = readStoredDaycare()
    if (saved) {
      const restored = getGameOption(saved.gameId)
      if (restored) {
        setGameId(restored.id)
        setTarget(saved.targetSpread)
        setOwnedParentRoles(saved.ownedParentRoles)
        setCompletedStepIds(saved.completedStepIds)
        setSelectedStrategyId(saved.selectedStrategyId ?? null)
      } else {
        removeJson(STORAGE_KEY)
      }
    }
    setGateDismissals(getJson<GateDismissals>(GATES_KEY) ?? {})
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const payload: StoredDaycare = {
      gameId,
      targetSpread: target,
      ownedParentRoles,
      completedStepIds,
      selectedStrategyId: selectedStrategyId ?? undefined,
    }
    setJson(STORAGE_KEY, payload)
  }, [
    hydrated,
    gameId,
    target,
    ownedParentRoles,
    completedStepIds,
    selectedStrategyId,
  ])

  function updateGateDismissals(next: GateDismissals) {
    setGateDismissals(next)
    setJson(GATES_KEY, next)
  }

  function selectGame(nextId: string) {
    const next = getGameOption(nextId)
    if (!next) return
    setGameId(next.id)
    setTarget(createDefaultTarget(next))
    setOwnedParentRoles([])
    setCompletedStepIds([])
    setSelectedStrategyId(null)
    removeJson(STORAGE_KEY)
  }

  function selectStrategy(id: string) {
    setSelectedStrategyId(id)
    setOwnedParentRoles([])
    setCompletedStepIds([])
  }

  function toggleOwned(role: 'A' | 'B') {
    setOwnedParentRoles((current) =>
      current.includes(role)
        ? current.filter((item) => role !== item)
        : [...current, role],
    )
  }

  function toggleStep(stepId: string) {
    setCompletedStepIds((current) =>
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId],
    )
  }

  const blockingMessage = blocked ? firstBlockingMessage(steps) : null

  const gameContext = (
    <>
      <GamePicker
        options={gamesCatalog}
        value={gameId}
        onChange={selectGame}
      />
      <GateBanner
        gameId={gameId}
        gates={featureGates}
        dismissed={gateDismissals}
        onDismissedChange={updateGateDismissals}
      />
    </>
  )

  return (
    <div className="space-y-[var(--spacing-section)]">
      {/*
        Game selector is page context (spec §10), not a target field.
        Desktop: title + selector on one row; gate sits under the selector.
        Mobile: title alone here; selector + gate open the Target pane.
      */}
      <div className="hidden lg:block">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <PageTitle>Daycare Planner</PageTitle>
            <p className="mt-2 text-sm text-body">
              Plan egg pairs, check inheritance rules, and route hatch efficiency
              for a target spread.
            </p>
          </div>
          <div className="w-[min(100%,18rem)] shrink-0 space-y-[var(--spacing-within)]">
            {gameContext}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <PageTitle className="mb-2">Daycare Planner</PageTitle>
        <p className="text-sm text-body">
          Plan egg pairs, check inheritance rules, and route hatch efficiency for
          a target spread.
        </p>
      </div>

      <DaycarePaneToggle value={mobilePane} onChange={setMobilePane} />

      {/*
        ≥1024px: form sticky | output (main 1.45fr plan sequence + sidebar hatch).
        Mobile: Target / Plan panes via segmented control.
      */}
      <div className="grid grid-cols-1 gap-[var(--spacing-section)] lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start">
        <aside
          className={
            mobilePane === 'target'
              ? 'space-y-[var(--spacing-within)] lg:sticky lg:top-4'
              : 'hidden space-y-[var(--spacing-within)] lg:sticky lg:top-4 lg:block'
          }
          role="tabpanel"
          id="daycare-pane-target-panel"
          aria-labelledby="daycare-pane-target"
        >
          <div className="space-y-[var(--spacing-within)] lg:hidden">
            {gameContext}
          </div>
          <section className="space-y-[var(--spacing-within)]">
            <div className="border-b border-edge pb-2">
              <h2 className="text-section font-medium text-bright">
                Target spread
              </h2>
            </div>
            <TargetSpreadForm
              value={target}
              game={game}
              speciesNames={speciesNames}
              natures={natures}
              abilityDescriptions={game.abilityDescriptions ?? {}}
              moveDescriptions={game.moveDescriptions ?? {}}
              eggMoveOptions={eggMoveOptions}
              ivPresets={ivPresets}
              maxIv={ruleset.ivInheritance.maxIv}
              generation={game.generation}
              naturesExist={ruleset.naturesExist}
              natureLock={ruleset.natureLock}
              abilitiesExist={ruleset.abilitiesExist}
              abilityInheritanceExists={
                ruleset.abilityInheritance.inheritanceExists
              }
              hiddenAbilitiesExist={ruleset.hiddenAbilitiesExist}
              shinyHint={
                shiny?.tiers.find((tier) => tier.id === 'base') ?? shiny?.tiers[0]
              }
              onChange={setTarget}
            />
          </section>
        </aside>

        <div
          className={
            mobilePane === 'plan'
              ? 'min-w-0'
              : 'hidden min-w-0 lg:block'
          }
          role="tabpanel"
          id="daycare-pane-plan-panel"
          aria-labelledby="daycare-pane-plan"
        >
          <div className="grid grid-cols-1 gap-[var(--spacing-section)] lg:grid-cols-[1.45fr_1fr] lg:items-start">
            <div className="min-w-0 space-y-[var(--spacing-section)]">
              {blocked && blockingMessage ? (
                <div
                  role="alert"
                  className="border-l-2 border-oxide bg-page py-3 pl-3"
                >
                  <p className="text-sm font-medium text-oxide">Blocked</p>
                  <p className="mt-1 text-item text-bright">{blockingMessage}</p>
                  <p className="mt-2 text-sm text-muted">
                    Nothing can be planned for this target in this game.
                  </p>
                </div>
              ) : null}

              {!blocked ? (
                <>
                  <ParentPairCard
                    strategies={strategies}
                    selectedStrategyId={activeStrategy?.id ?? ''}
                    routesEquivalent={plan.routesEquivalent}
                    excludedStrategies={plan.excludedStrategies}
                    ruleset={ruleset}
                    onSelectStrategy={selectStrategy}
                    ownedRoles={ownedSet}
                    onToggleOwned={toggleOwned}
                  />

                  <section className="space-y-[var(--spacing-within)]">
                    <div className="border-b border-edge pb-2">
                      <h2 className="text-section font-medium text-bright">
                        What to do
                      </h2>
                    </div>
                    {steps.length > 0 ? (
                      <PlanStepList
                        steps={steps.map((step, index) => ({
                          ...step,
                          order: index + 1,
                        }))}
                        completedStepIds={completedStepIds}
                        onToggleStep={toggleStep}
                      />
                    ) : null}
                  </section>

                  {shiny ? <ShinyOddsPanel shiny={shiny} /> : null}
                </>
              ) : null}
            </div>

            <aside className="min-w-0 space-y-[var(--spacing-section)] lg:sticky lg:top-4">
              <HatchRouteCard game={game} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

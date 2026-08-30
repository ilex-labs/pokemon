import PageTitle from '../components/shared/PageTitle'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  type PlayerFact,
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
import { formatHatchOutcome } from '../lib/hatchOutcome'
import { parentOwnershipKey, pruneOwnedParentKeys } from '../lib/parentOwnership'
import { readPlayerFacts, writePlayerFacts } from '../lib/playerFactsStorage'
import { formatReason } from '../lib/reason'
import { getJson, removeJson, setJson } from '../lib/storage'

const STORAGE_KEY = 'pokemon:daycare:v1'
const GATES_KEY = 'pokemon:gates:v1'

/** Persisted inputs only — plan output is always recomputed from the target. */
type StoredDaycare = {
  gameId: string
  targetSpread: DaycareTarget
  ownedParentKeys: string[]
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
  if ('ownedParentKeys' in stored) {
    if (!Array.isArray(stored.ownedParentKeys)) return false
    if (!stored.ownedParentKeys.every((key) => typeof key === 'string')) {
      return false
    }
  }
  if (
    stored.selectedStrategyId !== undefined &&
    typeof stored.selectedStrategyId !== 'string'
  ) {
    return false
  }

  return true
}

function readOwnedParentKeys(stored: Record<string, unknown>): string[] {
  if (!Array.isArray(stored.ownedParentKeys)) return []
  return stored.ownedParentKeys.filter((key) => typeof key === 'string')
}

function readStoredDaycare(): StoredDaycare | null {
  const raw = getJson<unknown>(STORAGE_KEY)
  if (!isStoredDaycare(raw)) {
    if (raw !== null) removeJson(STORAGE_KEY)
    return null
  }
  return {
    gameId: raw.gameId,
    targetSpread: raw.targetSpread,
    ownedParentKeys: readOwnedParentKeys(raw),
    completedStepIds: raw.completedStepIds,
    selectedStrategyId: raw.selectedStrategyId,
  }
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
    if (blocking) return formatReason(blocking)
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
  const [ownedParentKeys, setOwnedParentKeys] = useState<string[]>([])
  const [playerFacts, setPlayerFacts] = useState<PlayerFact[]>([])
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([])
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    null,
  )
  const userPickedStrategy = useRef(false)
  const defaultKeyRef = useRef(`${gameId}:${target.species}`)
  const [hydrated, setHydrated] = useState(false)
  /** Below md only — from 768px both panes show and this is ignored. */
  const [mobilePane, setMobilePane] = useState<'target' | 'plan'>('target')
  const [gateDismissals, setGateDismissals] = useState<GateDismissals>({})

  const ownedSet = useMemo(() => new Set(ownedParentKeys), [ownedParentKeys])

  const ivPresets = useMemo(
    () => filterIvPresets(game.ivPresets ?? sharedIvPresets, game.generation),
    [game],
  )

  const speciesNames = Object.keys(game.species)
  const eggMoveOptions = (game.eggMoves[target.species] ?? []).map(
    (entry) => entry.move,
  )

  // Live plan — pure function of game + ruleset + target + player facts.
  const plan = useMemo(
    () => planDaycare(game, ruleset, target, playerFacts),
    [game, ruleset, target, playerFacts],
  )

  const strategies = plan.strategies
  const defaultKey = `${gameId}:${target.species}`
  if (defaultKeyRef.current !== defaultKey) {
    defaultKeyRef.current = defaultKey
    userPickedStrategy.current = false
  }

  const recommendedId =
    (strategies.find((strategy) => strategy.recommended) ?? strategies[0])?.id ??
    null
  const selectionStillValid =
    selectedStrategyId !== null &&
    strategies.some((strategy) => strategy.id === selectedStrategyId)
  const nextSelectedId =
    userPickedStrategy.current && selectionStillValid
      ? selectedStrategyId
      : recommendedId
  if (nextSelectedId !== selectedStrategyId) {
    setSelectedStrategyId(nextSelectedId)
  }

  const activeStrategy =
    strategies.find((strategy) => strategy.id === nextSelectedId) ??
    strategies[0]

  const steps = useMemo(() => {
    if (!activeStrategy) return plan.steps
    if (activeStrategy.recommended || strategies.length <= 1) {
      return plan.steps
    }
    return stepsForStrategy(game, ruleset, target, activeStrategy)
  }, [plan, activeStrategy, strategies.length, game, ruleset, target])

  const hatchOutcome = useMemo(() => {
    const species = game.species[target.species]
    if (!species) return null
    return formatHatchOutcome(ruleset, species, target.species)
  }, [game, ruleset, target.species])

  const blocked = plan.blocked
  const shiny = plan.shiny
  const featureGates = plan.featureGates ?? game.featureGates ?? []

  // Drop completed ids that no longer exist after a recompute.
  useEffect(() => {
    const valid = new Set(steps.map((step) => step.id))
    setCompletedStepIds((current) => {
      const next = current.filter((id) => valid.has(id))
      return next.length === current.length ? current : next
    })
  }, [steps])

  const currentParentKeyList = (activeStrategy?.parents ?? [])
    .map(parentOwnershipKey)
    .join('\n')

  // Drop owned keys whose parent identity is no longer on the shown pair.
  useEffect(() => {
    const parents = activeStrategy?.parents ?? []
    setOwnedParentKeys((current) => {
      const next = pruneOwnedParentKeys(current, parents)
      return next.length === current.length ? current : next
    })
    // currentParentKeyList is the identity of the shown parents.
  }, [currentParentKeyList])

  useEffect(() => {
    const saved = readStoredDaycare()
    if (saved) {
      const restored = getGameOption(saved.gameId)
      if (restored) {
        setGameId(restored.id)
        setTarget(saved.targetSpread)
        setOwnedParentKeys(saved.ownedParentKeys)
        setPlayerFacts(readPlayerFacts(restored.id))
        setCompletedStepIds(saved.completedStepIds)
        setSelectedStrategyId(saved.selectedStrategyId ?? null)
      } else {
        removeJson(STORAGE_KEY)
        setPlayerFacts(readPlayerFacts(initialOption.id))
      }
    } else {
      setPlayerFacts(readPlayerFacts(initialOption.id))
    }
    setGateDismissals(getJson<GateDismissals>(GATES_KEY) ?? {})
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const payload: StoredDaycare = {
      gameId,
      targetSpread: target,
      ownedParentKeys,
      completedStepIds,
      selectedStrategyId: selectedStrategyId ?? undefined,
    }
    setJson(STORAGE_KEY, payload)
  }, [
    hydrated,
    gameId,
    target,
    ownedParentKeys,
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
    userPickedStrategy.current = false
    setGameId(next.id)
    setTarget(createDefaultTarget(next))
    setOwnedParentKeys([])
    setPlayerFacts(readPlayerFacts(next.id))
    setCompletedStepIds([])
    setSelectedStrategyId(null)
    removeJson(STORAGE_KEY)
  }

  function selectStrategy(id: string) {
    userPickedStrategy.current = true
    setSelectedStrategyId(id)
    setCompletedStepIds([])
  }

  function toggleOwnsDitto() {
    setPlayerFacts((current) => {
      const has = current.some((item) => item.fact === 'owns-ditto')
      const next: PlayerFact[] = has
        ? current.filter((item) => item.fact !== 'owns-ditto')
        : [...current, { fact: 'owns-ditto' }]
      writePlayerFacts(gameId, next)
      return next
    })
  }

  function toggleOwned(key: string) {
    setOwnedParentKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
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

  const formVisible = mobilePane === 'target'
  const planVisible = mobilePane === 'plan'

  return (
    <div className="space-y-[var(--spacing-within)] md:space-y-[var(--spacing-section)]">
      {/*
        Game selector is page context (spec §10), not a target field.
        Gate banner is its own row under the header — spanning the content
        width, not the selector's column.
      */}
      <div className="flex flex-col gap-[var(--spacing-within)] md:flex-row md:items-start md:gap-6">
        <div className="min-w-0 flex-1">
          <PageTitle>Daycare Planner</PageTitle>
          <p className="mt-2 hidden text-sm text-body md:block">
            Plan egg pairs, check inheritance rules, and route hatch efficiency
            for a target spread.
          </p>
        </div>
        <div className="w-full min-w-0 md:w-64 md:shrink-0">
          <GamePicker
            options={gamesCatalog}
            value={gameId}
            onChange={selectGame}
          />
        </div>
      </div>

      <GateBanner
        gameId={gameId}
        gates={featureGates}
        dismissed={gateDismissals}
        onDismissedChange={updateGateDismissals}
      />

      <DaycarePaneToggle value={mobilePane} onChange={setMobilePane} />

      {/*
        <768: single column + Target/Plan toggle.
        768–1179: form | plan, hatch beneath.
        ≥1180: form | plan | hatch — only once each track can hold its heading.
      */}
      <div className="daycare-layout">
        <aside
          className={
            formVisible
              ? 'daycare-form space-y-[var(--spacing-within)]'
              : 'daycare-form hidden space-y-[var(--spacing-within)] md:block'
          }
          role="tabpanel"
          id="daycare-pane-target-panel"
          aria-labelledby="daycare-pane-target"
        >
          <section className="space-y-[var(--spacing-within)]">
            <div className="border-b border-edge pb-2">
              <h2 className="text-item font-medium text-muted">
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
              masudaAvailable={Boolean(ruleset.masudaMethod)}
              shinyAbsenceNote={game.noEggShinyBoostsReason}
              onChange={setTarget}
            />
          </section>
        </aside>

        <div
          className={
            planVisible
              ? 'daycare-plan @container'
              : 'daycare-plan hidden @container md:block'
          }
          role="tabpanel"
          id="daycare-pane-plan-panel"
          aria-labelledby="daycare-pane-plan"
        >
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
                  routeComparisons={plan.routeComparisons}
                  excludedStrategies={plan.excludedStrategies}
                  ruleset={ruleset}
                  onSelectStrategy={selectStrategy}
                  ownedKeys={ownedSet}
                  onToggleOwned={toggleOwned}
                  ownsDitto={playerFacts.some((item) => item.fact === 'owns-ditto')}
                  onToggleOwnsDitto={toggleOwnsDitto}
                  hatchOutcome={hatchOutcome}
                />

                {steps.length > 0 ? (
                  <section className="space-y-[var(--spacing-within)]">
                    <div className="border-b border-edge pb-2">
                      <h2 className="text-section font-medium text-bright">
                        What to do
                      </h2>
                    </div>
                    <PlanStepList
                      steps={steps.map((step, index) => ({
                        ...step,
                        order: index + 1,
                      }))}
                      completedStepIds={completedStepIds}
                      onToggleStep={toggleStep}
                    />
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <aside
          className={
            planVisible
              ? 'daycare-hatch space-y-[var(--spacing-section)]'
              : 'daycare-hatch hidden space-y-[var(--spacing-section)] md:block'
          }
        >
          {target.wantsShiny ? (
            <>
              {shiny ? <ShinyOddsPanel shiny={shiny} /> : null}
              <HatchRouteCard game={game} />
            </>
          ) : (
            <>
              <HatchRouteCard game={game} />
              {shiny ? <ShinyOddsPanel shiny={shiny} /> : null}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

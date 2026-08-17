/**
 * Print strategies + PlanStep[] (and shiny payload) for each game in
 * src/data/games. Verification only — does not change engine behaviour.
 *
 * Games and rulesets are discovered from the data directories. Cases are
 * derived from each game's data: a plain target, an egg-move target when
 * the catalog has one, and a daycare-gate dump when that gate is present.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameData, Ruleset } from '../src/data/schema.ts'
import {
  planDaycare,
  type DaycarePlan,
  type DaycareTarget,
} from '../src/engine/daycareEngine.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const gamesDir = join(root, 'src/data/games')
const rulesetsDir = join(root, 'src/data/rulesets')

const ANY_IVS: DaycareTarget['ivs'] = {
  hp: 'any',
  atk: 'any',
  def: 'any',
  spa: 'any',
  spd: 'any',
  spe: 'any',
}

function loadJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function jsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(dir, name))
}

function loadGames(): GameData[] {
  return jsonFiles(gamesDir)
    .map((filePath) => loadJson(filePath) as GameData)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

function loadRulesets(): Ruleset[] {
  return jsonFiles(rulesetsDir).map((filePath) => loadJson(filePath) as Ruleset)
}

function mergeRuleset(base: Ruleset, overrides?: Partial<Ruleset>): Ruleset {
  if (!overrides) return base
  return {
    ...base,
    ...overrides,
    abilityInheritance: {
      ...base.abilityInheritance,
      ...overrides.abilityInheritance,
    },
    ivInheritance: {
      ...base.ivInheritance,
      ...overrides.ivInheritance,
    },
    hyperTraining: {
      ...base.hyperTraining,
      ...overrides.hyperTraining,
    },
    natureLock: overrides.natureLock ?? base.natureLock,
  }
}

function rulesetFor(game: GameData, rulesets: Ruleset[]): Ruleset {
  const base = rulesets.find(
    (ruleset) => ruleset.generation === game.generation,
  )
  if (!base) {
    throw new Error(
      `No ruleset for generation ${game.generation} (game ${game.id})`,
    )
  }
  return mergeRuleset(base, game.rulesetOverrides)
}

function firstSpecies(game: GameData): string {
  const name = Object.keys(game.species)[0]
  if (!name) {
    throw new Error(`${game.id}: species catalog is empty`)
  }
  return name
}

function plainTarget(species: string): DaycareTarget {
  return {
    species,
    nature: 'any',
    ability: 'any',
    eggMoves: [],
    ivs: { ...ANY_IVS },
  }
}

/** First species that lists an egg move, with that move selected. */
function eggMoveTarget(game: GameData): DaycareTarget | null {
  for (const [species, entries] of Object.entries(game.eggMoves ?? {})) {
    if (!game.species[species] || !Array.isArray(entries)) continue
    const move = entries[0]?.move
    if (!move) continue
    return { ...plainTarget(species), eggMoves: [move] }
  }
  return null
}

function hasDaycareGate(game: GameData): boolean {
  return (game.featureGates ?? []).some((gate) => gate.feature === 'daycare')
}

function printPlan(title: string, plan: DaycarePlan) {
  console.log('='.repeat(72))
  console.log(title)
  console.log(
    `blocked: ${plan.blocked} | strategies: ${plan.strategies.length} | steps: ${plan.steps.length}${
      plan.routesEquivalent ? ' | routes equivalent' : ''
    }`,
  )
  console.log('='.repeat(72))

  if (plan.featureGates.length > 0) {
    console.log('\n--- Feature gates ---')
    for (const gate of plan.featureGates) {
      console.log(`   ${gate.feature}: unlocked after ${gate.unlockedAfter}`)
    }
  }

  if (plan.strategies.length > 0) {
    console.log('\n--- Pairing strategies ---')
    for (const strategy of plan.strategies) {
      console.log(
        `\n  [${strategy.id}] ${strategy.label}${
          strategy.recommended
            ? ` (recommended — ${strategy.recommendReason ?? 'no reason'})`
            : ''
        }`,
      )
      console.log(`   acquisition: ${strategy.acquisitionCost}`)
      console.log(`   tradeoff: ${strategy.tradeoff}`)
      for (const parent of strategy.parents) {
        console.log(`\n   Parent ${parent.role}`)
        console.log(
          `    ${parent.gender ? parent.gender + ' ' : ''}${parent.species.join(', ')}`,
        )
        if (parent.genderReason) {
          console.log(`    gender/species: ${parent.genderReason}`)
        }
        if (parent.mustHaveNature) {
          console.log(`    nature: ${parent.mustHaveNature}`)
        }
        if (parent.mustHaveAbility) {
          console.log(`    ability: ${parent.mustHaveAbility}`)
        }
        if (parent.mustKnow?.length) {
          console.log(`    must know: ${parent.mustKnow.join(', ')}`)
        }
        if (parent.mustOriginateFromDifferentLanguage) {
          console.log('    origin: language differs from its partner')
        }
        if (parent.heldItem) console.log(`    held item: ${parent.heldItem}`)
        else console.log('    held item: (open)')
        if (parent.acquisition?.length) {
          for (const flag of parent.acquisition) {
            console.log(`    acquisition (${flag.severity}): ${flag.message}`)
          }
        }
      }
    }
  }

  if (plan.excludedStrategies && plan.excludedStrategies.length > 0) {
    console.log('\n--- Excluded strategies ---')
    for (const excluded of plan.excludedStrategies) {
      console.log(`   [${excluded.id}] ${excluded.label} — ${excluded.reason}`)
    }
  }

  console.log('\n--- What to do (steps for recommended / first) ---')
  for (const step of plan.steps) {
    console.log(`\n${step.order}. [${step.id}]`)
    console.log(`   ${step.instruction}`)
    if (step.ruleFlags && step.ruleFlags.length > 0) {
      for (const flag of step.ruleFlags) {
        console.log(`   flag (${flag.severity}): ${flag.message}`)
      }
    }
  }

  if (plan.shiny) {
    console.log('\n--- shiny payload ---')
    if (plan.shiny.noBoostsReason) {
      console.log(`   ${plan.shiny.noBoostsReason}`)
    }
    for (const tier of plan.shiny.tiers) {
      console.log(
        `   ${tier.label}: ${tier.odds} (~${tier.approximateEggs} eggs)`,
      )
      if (tier.context) console.log(`     ${tier.context}`)
    }
    console.log(`   ${plan.shiny.determinedOnReceive}`)
  }

  console.log('')
}

const rulesets = loadRulesets()
const games = loadGames()
if (games.length === 0) {
  throw new Error(`No game JSON files in ${gamesDir}`)
}

for (const game of games) {
  const ruleset = rulesetFor(game, rulesets)
  const unconstrained = plainTarget(firstSpecies(game))

  printPlan(
    `${game.displayName} — plain target`,
    planDaycare(game, ruleset, unconstrained),
  )

  const withEggMove = eggMoveTarget(game)
  if (withEggMove) {
    const move = withEggMove.eggMoves[0]
    printPlan(
      `${game.displayName} — egg move (${move} onto ${withEggMove.species})`,
      planDaycare(game, ruleset, withEggMove),
    )
  }

  if (hasDaycareGate(game)) {
    printPlan(
      `${game.displayName} — daycare gate`,
      planDaycare(game, ruleset, unconstrained),
    )
  }
}

/**
 * Print strategies + PlanStep[] (and shiny payload) for the acceptance cases.
 * Verification only — does not change engine behaviour.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { planDaycare } from '../src/engine/daycareEngine.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadJson(relativePath: string) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
}

const gen9 = loadJson('src/data/rulesets/gen9.json')
const scarletViolet = loadJson('src/data/games/scarlet-violet.json')

const baseTarget = {
  species: 'Charmander',
  nature: 'Timid',
  ability: 'Blaze',
  eggMoves: ['Dragon Dance'],
  ivs: {
    hp: 31,
    atk: 0,
    def: 31,
    spa: 31,
    spd: 31,
    spe: 31,
  },
}

function printPlan(
  title: string,
  plan: {
    blocked: boolean
    routesEquivalent?: boolean
    strategies: Array<{
      id: string
      label: string
      acquisitionCost: string
      tradeoff: string
      recommended?: boolean
      recommendReason?: string
      parents: Array<{
        role: string
        species: string[]
        gender?: string
        genderReason?: string
        mustKnow?: string[]
        mustHaveAbility?: string
        mustHaveNature?: string
        heldItem?: string
        mustOriginateFromDifferentLanguage?: boolean
        acquisition?: Array<{ severity: string; message: string }>
      }>
    }>
    steps: Array<{
      id: string
      order: number
      instruction: string
      ruleFlags?: Array<{ severity: string; message: string }>
    }>
    shiny?: {
      tiers: Array<{
        id: string
        label: string
        odds: string
        approximateEggs: number
        context?: string
      }>
      noBoostsReason?: string
      determinedOnReceive: string
    }
  },
) {
  console.log('='.repeat(72))
  console.log(title)
  console.log(
    `blocked: ${plan.blocked} | strategies: ${plan.strategies.length} | steps: ${plan.steps.length}${
      plan.routesEquivalent ? ' | routes equivalent' : ''
    }`,
  )
  console.log('='.repeat(72))

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

const case1 = planDaycare(scarletViolet, gen9, baseTarget)
printPlan(
  'Case 1 — Timid / Blaze / Dragon Dance / IV spread, no shiny',
  case1,
)

const case2 = planDaycare(scarletViolet, gen9, {
  ...baseTarget,
  wantsShiny: true,
})
printPlan('Case 2 — same + wantsShiny: true', case2)

const case3Ruleset = {
  ...gen9,
  abilityInheritance: {
    ...gen9.abilityInheritance,
    hiddenAbilityViaEggs: false,
  },
}
const case3 = planDaycare(scarletViolet, case3Ruleset, {
  ...baseTarget,
  ability: 'Solar Power',
})
printPlan(
  'Case 3 — Solar Power with hiddenAbilityViaEggs: false (harness override; plan continues)',
  case3,
)

const case4Game = {
  ...scarletViolet,
  ditto: {
    ...scarletViolet.ditto,
    available: false,
  },
  species: {
    ...scarletViolet.species,
    Charmander: {
      ...scarletViolet.species.Charmander,
      genderRatio: 'genderless',
    },
  },
}
const case4 = planDaycare(case4Game, gen9, baseTarget)
printPlan(
  'Case 4 — genderless + ditto.available: false (harness override; plan truncated)',
  case4,
)

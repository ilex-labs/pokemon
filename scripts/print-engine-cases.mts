/**
 * Print full PlanStep[] for the acceptance cases.
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

function printSteps(
  title: string,
  steps: Array<{
    id: string
    order: number
    instruction: string
    ruleFlags?: Array<{ severity: string; message: string }>
  }>,
  blocked: boolean,
) {
  console.log('='.repeat(72))
  console.log(title)
  console.log(`blocked: ${blocked} | steps: ${steps.length}`)
  console.log('='.repeat(72))

  for (const step of steps) {
    console.log(`\n${step.order}. [${step.id}]`)
    console.log(`   ${step.instruction}`)
    if (step.ruleFlags && step.ruleFlags.length > 0) {
      for (const flag of step.ruleFlags) {
        console.log(`   flag (${flag.severity}): ${flag.message}`)
      }
    }
  }
  console.log('')
}

const case1 = planDaycare(scarletViolet, gen9, baseTarget)
printSteps(
  'Case 1 — Timid / Blaze / Dragon Dance / IV spread, no shiny',
  case1.steps,
  case1.blocked,
)

const case2 = planDaycare(scarletViolet, gen9, {
  ...baseTarget,
  wantsShiny: true,
})
printSteps('Case 2 — same + wantsShiny: true', case2.steps, case2.blocked)

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
printSteps(
  'Case 3 — Solar Power with hiddenAbilityViaEggs: false (harness override; plan continues)',
  case3.steps,
  case3.blocked,
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
printSteps(
  'Case 4 — genderless + ditto.available: false (harness override; plan truncated)',
  case4.steps,
  case4.blocked,
)

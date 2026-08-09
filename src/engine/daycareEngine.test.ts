import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen9 = gen9Json as Ruleset
const scarletViolet = scarletVioletJson as GameData

const baseTarget: DaycareTarget = {
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

describe('daycareEngine acceptance cases', () => {
  it('Case 1: Timid / Blaze / Dragon Dance — guarantee Everstone, Mirror Herb, no odds quote', () => {
    const plan = planDaycare(scarletViolet, gen9, baseTarget)

    expect(plan.blocked).toBe(false)
    expect(plan.steps).toHaveLength(7)

    const [parents, nature, ability, eggMove, ivBase, destinyKnot, powerItems] =
      plan.steps

    expect(parents.instruction).toMatch(/Charmander/)
    expect(parents.instruction).toMatch(/egg groups: monster \/ dragon/)
    expect(parents.instruction).not.toMatch(/Ditto/i)
    expect(parents.instruction).not.toMatch(/\.\.$/)

    expect(nature.instruction).toMatch(/guarantee/i)
    expect(nature.instruction).not.toMatch(/50%/)
    expect(nature.instruction).toMatch(/Everstone/)
    expect(nature.instruction).toMatch(/Timid/)

    expect(ability.instruction).toMatch(/Blaze/)
    expect(ability.instruction).not.toMatch(/\d+%/)
    expect(JSON.stringify(ability)).not.toMatch(/\d+%/)

    expect(eggMove.instruction).toMatch(/Dragon Dance/)
    expect(eggMove.instruction).toMatch(/Mirror Herb/)
    expect(eggMove.instruction).not.toMatch(/move reminder/i)

    expect(ivBase.instruction).toMatch(/\baround 3 IVs\b/)
    expect(destinyKnot.instruction).toMatch(/Destiny Knot/)
    expect(destinyKnot.instruction).toMatch(/\bfrom 3 to 5\b/)
    expect(powerItems.instruction).toMatch(/power items/i)
  })

  it('Case 2: wantsShiny adds Masuda, Shiny Charm, and shiny-marks pointer — never Sparkling Power', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      wantsShiny: true,
    })

    expect(plan.blocked).toBe(false)
    expect(plan.steps).toHaveLength(10)

    const shinySteps = plan.steps.slice(7)
    expect(shinySteps.map((step) => step.id)).toEqual([
      'masuda',
      'shiny-charm',
      'shiny-marks-pointer',
    ])

    expect(shinySteps[0].instruction).toMatch(/Masuda Method/i)
    expect(shinySteps[1].instruction).toMatch(/Shiny Charm/i)
    expect(shinySteps[2].instruction).toMatch(/Shiny & Marks/i)

    const blob = JSON.stringify(plan.steps)
    expect(blob).not.toMatch(/Sparkling Power/i)
  })

  it('Case 3: hiddenAbilityViaEggs false flags Solar Power but keeps the rest of the plan', () => {
    const ruleset: Ruleset = {
      ...gen9,
      abilityInheritance: {
        ...gen9.abilityInheritance,
        hiddenAbilityViaEggs: false,
      },
    }

    // gen9.json itself must remain true — only the harness overrides.
    expect(gen9.abilityInheritance.hiddenAbilityViaEggs).toBe(true)

    const plan = planDaycare(scarletViolet, ruleset, {
      ...baseTarget,
      ability: 'Solar Power',
    })

    expect(plan.blocked).toBe(false)
    expect(plan.steps).toHaveLength(7)

    const [parents, nature, ability, eggMove, ivBase, destinyKnot, powerItems] =
      plan.steps

    expect(parents.id).toBe('parents')
    expect(nature.id).toBe('nature')
    expect(nature.instruction).toMatch(/guarantee/i)

    expect(ability.id).toBe('ability')
    expect(ability.instruction).toMatch(/Solar Power/)
    expect(ability.instruction).toMatch(/cannot be passed via eggs/i)
    expect(ability.instruction).toMatch(/Ability Patch|Ability Capsule/)

    const blocking = ability.ruleFlags?.filter((flag) => flag.severity === 'blocking')
    expect(blocking?.length).toBeGreaterThan(0)
    expect(blocking?.[0]?.message).toMatch(/Solar Power/)

    expect(eggMove.id).toMatch(/^egg-move-/)
    expect(eggMove.instruction).toMatch(/Mirror Herb/)
    expect(ivBase.id).toBe('iv-base')
    expect(destinyKnot.id).toBe('destiny-knot')
    expect(powerItems.id).toBe('power-items')
  })

  it('Case 4: genderless + no Ditto truncates with blocked: true', () => {
    // scarlet-violet.json itself must keep Ditto available — only the harness overrides.
    expect(scarletViolet.ditto.available).toBe(true)

    const game: GameData = {
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

    const plan = planDaycare(game, gen9, baseTarget)

    expect(plan.blocked).toBe(true)
    expect(plan.steps).toHaveLength(1)

    const [parents] = plan.steps
    expect(parents.id).toBe('parents')
    expect(parents.instruction).toMatch(/Ditto/i)
    expect(parents.instruction).toMatch(/not obtainable|unavailable/i)

    const blocking = parents.ruleFlags?.filter((flag) => flag.severity === 'blocking')
    expect(blocking?.length).toBeGreaterThan(0)
    expect(blocking?.[0]?.message).toMatch(/no valid pair/i)

    expect(plan.steps.some((step) => step.id === 'nature')).toBe(false)
    expect(plan.steps.some((step) => step.id.startsWith('egg-move'))).toBe(false)
    expect(plan.steps.some((step) => step.id === 'iv-base')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'destiny-knot')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'power-items')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'masuda')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'shiny-charm')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'shiny-marks-pointer')).toBe(false)
  })
})

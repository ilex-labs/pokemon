import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen3Json from '../data/rulesets/gen3.json'
import frlgJson from '../data/games/firered-leafgreen.json'
import { speciesAbilityGroups } from '../data/loadGame'
import {
  eggAffectingHeldItemsExist,
  planDaycare,
  stepsForStrategy,
  type DaycareTarget,
} from './daycareEngine'

const gen3 = gen3Json as Ruleset
const frlg = frlgJson as GameData

const baseTarget: DaycareTarget = {
  species: 'Charmander',
  nature: 'Timid',
  ability: 'Blaze',
  eggMoves: ['Dragon Dance'],
  ivs: {
    hp: 31,
    atk: 31,
    def: 31,
    spa: 31,
    spd: 31,
    spe: 31,
  },
}

describe('FireRed/LeafGreen — ruleset branches never exercised by gen 9', () => {
  it('egg-move step names the father specifically, not either parent', () => {
    const plan = planDaycare(frlg, gen3, baseTarget)
    const eggStep = plan.steps.find((step) => step.id === 'egg-moves')
    expect(eggStep).toBeDefined()
    expect(eggStep?.instruction).toMatch(/the father must know/i)
    expect(eggStep?.instruction).not.toMatch(/either parent/i)
    expect(eggStep?.instruction).toMatch(/Dragon Dance/)
  })

  it('emits no Everstone step at all — not a hedged one', () => {
    const plan = planDaycare(frlg, gen3, baseTarget)
    expect(JSON.stringify(plan.steps)).not.toMatch(/Everstone/i)
    for (const strategy of plan.strategies) {
      for (const parent of strategy.parents) {
        expect(parent.heldItem).not.toBe('Everstone')
        expect(parent.mustHaveNature).toBeUndefined()
      }
    }
    // Nature lock absence is a form constraint, not a numbered step.
    expect(plan.steps.some((step) => step.id === 'nature')).toBe(false)
  })

  it('assemble outcome notes eggs hatch at level 5', () => {
    expect(gen3.hatchLevel).toBe(5)
    const plan = planDaycare(frlg, gen3, baseTarget)
    const assemble = plan.steps.find((step) => step.id === 'assemble')
    expect(assemble?.instruction).toMatch(/Eggs hatch as Charmander at level 5\./)
    expect(assemble?.instruction).not.toMatch(/level 1/)
  })

  it('random ability is not a plan step when inheritance does not exist', () => {
    const plan = planDaycare(frlg, gen3, {
      ...baseTarget,
      eggMoves: [],
      nature: 'any',
      ivs: {
        hp: 'any',
        atk: 'any',
        def: 'any',
        spa: 'any',
        spd: 'any',
        spe: 'any',
      },
    })

    expect(plan.steps.some((step) => step.id === 'ability')).toBe(false)
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.id).toBe('assemble')
    expect(plan.steps[0]?.instruction).toMatch(
      /^Pair two Charmander and hatch\. Eggs hatch at level 5\.$/,
    )

    for (const strategy of plan.strategies) {
      for (const parent of strategy.parents) {
        expect(parent.mustHaveAbility).toBeUndefined()
        expect(
          parent.acquisition?.filter((flag) =>
            /ability|Blaze|inherit/i.test(flag.message),
          ) ?? [],
        ).toEqual([])
        expect(parent.genderReason ?? '').not.toMatch(/ability/i)
      }
    }
    expect(plan.excludedStrategies ?? []).toEqual([])
  })

  it('ability dropdown data has no Hidden group when hiddenAbilitiesExist is false', () => {
    expect(gen3.hiddenAbilitiesExist).toBe(false)
    const groups = speciesAbilityGroups(frlg, 'Charmander', {
      hiddenAbilitiesExist: gen3.hiddenAbilitiesExist,
    })
    expect(groups.standard).toEqual(['Blaze'])
    expect(groups.hidden).toBeUndefined()
  })

  it('feature gate metadata is present and the plan still generates', () => {
    const plan = planDaycare(frlg, gen3, baseTarget)
    expect(plan.blocked).toBe(false)
    expect(plan.strategies.length).toBeGreaterThan(0)
    expect(plan.steps.length).toBeGreaterThan(0)
    expect(plan.featureGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: 'daycare',
          unlockedAfter: expect.stringMatching(/Four Island|Rainbow Pass/i),
        }),
      ]),
    )
  })

  it('emits no Destiny Knot, power-item, or Hyper Training guidance', () => {
    const plan = planDaycare(frlg, gen3, {
      ...baseTarget,
      wantsPowerItem: true,
    })
    const blob = JSON.stringify(plan)
    expect(blob).not.toMatch(/Destiny Knot/i)
    expect(blob).not.toMatch(/power item/i)
    expect(blob).not.toMatch(/Hyper Training/i)
    expect(blob).not.toMatch(/Bottle Cap/i)
    expect(blob).not.toMatch(/Held items are already assigned/i)

    for (const strategy of plan.strategies) {
      for (const parent of strategy.parents) {
        expect(parent.heldItem).toBeUndefined()
        expect(parent.heldItemReason).toBeUndefined()
      }
    }

    expect(eggAffectingHeldItemsExist(gen3)).toBe(false)
  })

  it('egg-move Ditto route is offered with a species-route prerequisite — circular to bootstrap, not invalid', () => {
    expect(gen3.eggMoveMethod).toBe('eggs-only')
    expect(frlg.eggMoveAlternative).toBeUndefined()

    const plan = planDaycare(frlg, gen3, baseTarget)
    const ditto = plan.strategies.find((strategy) => strategy.id === 'ditto-pair')
    expect(ditto).toBeDefined()
    expect(ditto?.acquisitionCost).toMatch(/already knows/i)
    expect(ditto?.tradeoff).toMatch(/species-pair route first/i)
    expect(ditto?.tradeoff).not.toMatch(/consolidat/i)

    const charmander = ditto?.parents.find((parent) =>
      parent.species.includes('Charmander'),
    )
    expect(charmander?.gender).toBe('male')
    expect(charmander?.genderReason).toMatch(/father passes egg moves/i)
    expect(charmander?.mustKnow).toEqual(
      expect.arrayContaining(['Dragon Dance']),
    )
    expect(
      charmander?.acquisition?.some((flag) =>
        /species-pair route first/i.test(flag.message),
      ),
    ).toBe(true)

    const dittoSteps = stepsForStrategy(frlg, gen3, baseTarget, ditto!)
    const prereq = dittoSteps.find((step) => step.id === 'egg-moves-prerequisite')
    expect(prereq?.instruction).toMatch(/species-pair route first/i)
    expect(JSON.stringify(dittoSteps)).not.toMatch(/consolidat|Mirror Herb/i)
  })
})

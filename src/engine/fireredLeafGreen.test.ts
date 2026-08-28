import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen3Json from '../data/rulesets/gen3.json'
import frlgJson from '../data/games/firered-leafgreen.json'
import { speciesAbilityGroups } from '../data/loadGame'
import { formatReason, formatReasons, type Reason } from '../lib/reason'
import {
  eggAffectingHeldItemsExist,
  planDaycare,
  type DaycareTarget,
} from './daycareEngine'

const gen3 = gen3Json as Ruleset
const frlg = frlgJson as GameData

function genderProse(parent: { genderReason?: Reason[] } | undefined): string {
  return formatReasons(parent?.genderReason ?? [])
}

function flagProse(flag: Reason): string {
  return formatReason(flag)
}

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

  it('gen3 hatchLevel is 5', () => {
    expect(gen3.hatchLevel).toBe(5)
  })

  it("gen3 eggMoveEligibleParents is 'male-only'", () => {
    expect(gen3.eggMoveEligibleParents).toBe('male-only')
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

    expect(plan.steps).toEqual([])

    for (const strategy of plan.strategies) {
      for (const parent of strategy.parents) {
        expect(parent.mustHaveAbility).toBeUndefined()
        expect(
          parent.acquisition?.filter((flag) =>
            /ability|Blaze|inherit/i.test(flagProse(flag)),
          ) ?? [],
        ).toEqual([])
        expect(genderProse(parent)).not.toMatch(/ability/i)
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
    expect(genderProse(charmander)).toMatch(/father passes egg moves/i)
    expect(charmander?.mustKnow).toEqual(
      expect.arrayContaining(['Dragon Dance']),
    )
    expect(
      charmander?.acquisition?.some((flag) =>
        /species-pair route first/i.test(flagProse(flag)),
      ),
    ).toBe(true)

    expect(plan.routeComparison).toBeUndefined()
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(speciesPair?.recommended).toBe(true)
    expect(speciesPair?.recommendReason).toEqual({
      code: 'recommend-start-from-hatch',
    })
    expect(ditto?.recommended).toBeUndefined()
    expect(ditto?.requiresRoute).toEqual({
      id: 'species-pair',
      reason: {
        code: 'requires-hatch-from-route',
        fromLabel: 'Species pair',
        moves: ['Dragon Dance'],
      },
    })
  })

  it('wantsShiny adds no Masuda constraint and names the absent shiny mechanics', () => {
    expect(gen3.masudaMethod).toBeUndefined()
    expect(gen3.baseShinyOdds.odds).toBe('1/8192')
    expect(frlg.shinyEggModifiers).toBeUndefined()

    const plan = planDaycare(frlg, gen3, {
      ...baseTarget,
      wantsShiny: true,
    })

    expect(plan.blocked).toBe(false)
    for (const strategy of plan.strategies) {
      for (const parent of strategy.parents) {
        expect(parent.mustOriginateFromDifferentLanguage).toBeUndefined()
        expect(
          parent.acquisition?.filter((flag) =>
            /Masuda|different-language/i.test(flagProse(flag)),
          ) ?? [],
        ).toEqual([])
      }
    }

    expect(plan.shiny).toBeDefined()
    expect(plan.shiny?.tiers.map((tier) => tier.id)).toEqual(['base'])
    expect(plan.shiny?.tiers[0]?.odds).toBe('1/8192')
    expect(plan.shiny?.tiers[0]?.odds).not.toBe('1/4096')
    expect(plan.shiny?.noBoostsReason).toMatch(/Masuda Method doesn't exist/i)
    expect(plan.shiny?.noBoostsReason).toMatch(/Generation IV/i)
    expect(plan.shiny?.noBoostsReason).toMatch(/Shiny Charm came later still/i)
    expect(plan.shiny?.noBoostsReason).toMatch(/Generation V/i)
    expect(plan.shiny?.noBoostsReason).toMatch(
      /Base odds are the only egg shiny odds/i,
    )
    expect(plan.shiny?.determinedOnReceive).toMatch(
      /decided the moment you receive the egg/i,
    )
    expect(plan.steps.some((step) => step.id === 'masuda')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'shiny-charm')).toBe(false)
    expect(JSON.stringify(plan.steps)).not.toMatch(/Obtain the Shiny Charm/i)
    expect(plan.routeComparison).toBeUndefined()
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    const dittoPair = plan.strategies.find(
      (strategy) => strategy.id === 'ditto-pair',
    )
    expect(speciesPair?.recommended).toBe(true)
    expect(speciesPair?.recommendReason).toEqual({
      code: 'recommend-start-from-hatch',
    })
    expect(dittoPair?.recommended).toBeUndefined()
    expect(dittoPair?.requiresRoute?.id).toBe('species-pair')
  })
})

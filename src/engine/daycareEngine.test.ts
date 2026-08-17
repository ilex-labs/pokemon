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

function recommendedParents(plan: ReturnType<typeof planDaycare>) {
  const strategy =
    plan.strategies.find((item) => item.recommended) ?? plan.strategies[0]
  return strategy?.parents ?? []
}

describe('daycareEngine acceptance cases', () => {
  it('Case 1: species strategy resolves the pair; Everstone guaranteed; Mirror Herb; no ability odds quote', () => {
    const plan = planDaycare(scarletViolet, gen9, baseTarget)

    expect(plan.blocked).toBe(false)
    expect(plan.shiny).toBeDefined()
    expect(plan.shiny?.tiers.map((tier) => tier.id)).toEqual([
      'base',
      'shinyCharm',
      'masuda',
      'masudaPlusCharm',
    ])

    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    const dittoPair = plan.strategies.find(
      (strategy) => strategy.id === 'ditto-pair',
    )
    // Both routes need two parents — recommend neither.
    expect(plan.routesEquivalent).toBe(true)
    expect(speciesPair?.recommended).toBeUndefined()
    expect(dittoPair?.recommended).toBeUndefined()
    expect(speciesPair?.acquisitionCost).toMatch(/Charmander/i)
    expect(dittoPair?.acquisitionCost).toMatch(/Ditto/i)
    expect(speciesPair?.parents).toHaveLength(2)

    const natureParent = speciesPair?.parents.find(
      (parent) => parent.mustHaveNature,
    )
    expect(natureParent).toMatchObject({
      species: ['Charmander'],
      gender: 'female',
      mustHaveNature: 'Timid',
      heldItem: 'Everstone',
    })
    expect(natureParent?.mustHaveAbility).toBeUndefined()
    expect(natureParent?.heldItemReason).toMatch(/Timid/)
    expect(natureParent?.heldItemReason).toMatch(/Guarantees/i)
    expect(natureParent?.genderReason).toMatch(
      /female because the female parent determines/i,
    )
    expect(natureParent?.genderReason).not.toMatch(/egg-move carrier/i)

    const moveParent = speciesPair?.parents.find((parent) =>
      parent.mustKnow?.includes('Dragon Dance'),
    )
    expect(moveParent?.gender).toBe('male')
    expect(moveParent?.genderReason).toMatch(
      /male because a female .+ would produce .+ eggs instead/i,
    )
    expect(moveParent?.genderReason).not.toMatch(
      /female parent determines the offspring/i,
    )
    expect(moveParent?.species).toEqual(
      expect.arrayContaining(['Salamence', 'Dragapult', 'Gyarados']),
    )
    expect(moveParent?.heldItem).toBe('Destiny Knot')
    expect(moveParent?.heldItemReason).toMatch(/IV target/i)
    expect(moveParent?.heldItemReason).toMatch(/3 to 5/)

    const assemble = plan.steps.find((step) => step.id === 'assemble')
    expect(assemble?.instruction).toMatch(/Charmander/)
    expect(assemble?.instruction).toMatch(/Salamence|Dragapult|Gyarados/)
    expect(assemble?.instruction).toMatch(/Eggs hatch as Charmander at level 1\./)
    expect(assemble?.instruction).not.toMatch(/Ditto/i)
    expect(assemble?.instruction).not.toMatch(/egg groups:\s*monster\s*\/\s*dragon/i)
    expect(gen9.hatchLevel).toBe(1)

    const nature = plan.steps.find((step) => step.id === 'nature')
    expect(nature?.instruction).toMatch(/guarantee/i)
    expect(nature?.instruction).not.toMatch(/50%/)
    expect(nature?.instruction).toMatch(/Everstone/)
    expect(nature?.instruction).toMatch(/Timid/)

    // Blaze is Charmander's only standard ability — automatic, no inherit step.
    expect(plan.steps.some((step) => step.id === 'ability')).toBe(false)

    const eggAlt = plan.steps.find((step) => step.id === 'egg-move-alternative')
    expect(eggAlt?.instruction).toMatch(/Mirror Herb/)
    expect(eggAlt?.instruction).toMatch(/Salamence|Dragapult|Gyarados/)
    expect(eggAlt?.instruction).not.toMatch(/move reminder/i)

    const ivBase = plan.steps.find((step) => step.id === 'iv-base')
    expect(ivBase?.instruction).toMatch(/\baround 3 IVs\b/)
    expect(ivBase?.instruction).toMatch(/Destiny Knot/)
    expect(ivBase?.instruction).toMatch(/\bfrom 3 to 5\b/)
    expect(ivBase?.instruction).not.toMatch(/power item/i)

    expect(plan.steps.some((step) => step.id === 'destiny-knot')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'power-items')).toBe(false)
  })

  it('Case 2: wantsShiny adds a Masuda parent constraint, recommends Ditto, and never Sparkling Power', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      wantsShiny: true,
    })

    expect(plan.blocked).toBe(false)
    expect(plan.steps.some((step) => step.id === 'masuda')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'shiny-charm')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'shiny-marks-pointer')).toBe(
      false,
    )

    expect(plan.shiny).toBeDefined()
    expect(plan.shiny?.tiers.map((tier) => tier.id)).toEqual([
      'base',
      'shinyCharm',
      'masuda',
      'masudaPlusCharm',
    ])
    expect(plan.shiny?.tiers[0]?.odds).toBe('1/4096')
    expect(plan.shiny?.tiers[1]?.odds).toBe('2/4096')
    expect(plan.shiny?.tiers[1]?.approximateEggs).toBe(2048)
    expect(plan.shiny?.tiers[2]?.odds).toBe('6/4096')
    expect(plan.shiny?.tiers[3]?.odds).toBe('8/4096')
    expect(plan.shiny?.noBoostsReason).toBeUndefined()
    expect(plan.shiny?.determinedOnReceive).toMatch(
      /decided the moment you receive the egg/i,
    )
    expect(plan.shiny?.determinedOnReceive).toMatch(
      /hatch-speed modifiers don't change the odds/i,
    )
    expect(plan.shiny?.determinedOnReceive).toMatch(
      /resetting after that point can't change the result/i,
    )
    const charmAlone = plan.shiny?.tiers.find((tier) => tier.id === 'shinyCharm')
    expect(charmAlone?.context).toMatch(/Paldea Pokédex/i)
    expect(charmAlone?.context).not.toMatch(/two egg rolls/i)
    expect(charmAlone?.context).not.toMatch(/not 3\/4096/i)
    expect(charmAlone?.context).not.toMatch(/obtain the Shiny Charm/i)
    const masudaTier = plan.shiny?.tiers.find((tier) => tier.id === 'masuda')
    expect(masudaTier?.context).toMatch(/different-language game than its partner/i)
    const stacked = plan.shiny?.tiers.find(
      (tier) => tier.id === 'masudaPlusCharm',
    )
    expect(stacked?.context).toBeUndefined()

    expect(plan.routesEquivalent).toBeUndefined()
    const dittoPair = plan.strategies.find(
      (strategy) => strategy.id === 'ditto-pair',
    )
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(dittoPair?.recommended).toBe(true)
    expect(dittoPair?.recommendReason).toMatch(
      /A Ditto works with any species/i,
    )
    expect(dittoPair?.recommendReason).toMatch(/reuse it for other hatches/i)
    expect(dittoPair?.recommendReason).not.toMatch(/every future project/i)
    expect(speciesPair?.recommended).toBeUndefined()

    const dittoParent = dittoPair?.parents.find((parent) =>
      parent.species.includes('Ditto'),
    )
    expect(dittoParent?.mustOriginateFromDifferentLanguage).toBe(true)
    expect(
      dittoParent?.acquisition?.some((flag) =>
        /already have one/i.test(flag.message),
      ),
    ).toBe(true)
    expect(
      dittoParent?.acquisition?.some((flag) =>
        /Japanese Charmander with an English Ditto/i.test(flag.message),
      ),
    ).toBe(true)
    expect(
      dittoParent?.acquisition?.some((flag) =>
        /any two parents from different-language/i.test(flag.message),
      ),
    ).toBe(false)
    expect(
      dittoParent?.acquisition?.some((flag) =>
        /Must originate from a different-language/i.test(flag.message),
      ),
    ).toBe(false)
    expect(
      dittoParent?.acquisition?.some((flag) =>
        /Masuda Method needs a parent from a different-language/i.test(
          flag.message,
        ),
      ),
    ).toBe(false)
    expect(
      dittoParent?.acquisition?.some((flag) =>
        /trade|import|cartridge/i.test(flag.message),
      ),
    ).toBe(true)

    const speciesLanguageParent = speciesPair?.parents.find(
      (parent) => parent.mustOriginateFromDifferentLanguage,
    )
    expect(speciesLanguageParent).toBeDefined()
    expect(speciesLanguageParent?.species).toEqual(['Charmander'])

    const blob = JSON.stringify(plan)
    expect(blob).not.toMatch(/Sparkling Power/i)
    expect(blob).not.toMatch(/Shiny & Marks/i)
    expect(blob).not.toMatch(/Obtain the Shiny Charm/i)
  })

  it('Case 3: hiddenAbilityViaEggs false flags Solar Power but keeps the rest of the plan', () => {
    const ruleset: Ruleset = {
      ...gen9,
      abilityInheritance: {
        ...gen9.abilityInheritance,
        hiddenAbilityViaEggs: false,
      },
    }

    expect(gen9.abilityInheritance.hiddenAbilityViaEggs).toBe(true)

    const plan = planDaycare(scarletViolet, ruleset, {
      ...baseTarget,
      ability: 'Solar Power',
    })

    expect(plan.blocked).toBe(false)
    expect(plan.strategies.length).toBeGreaterThan(0)

    const ability = plan.steps.find((step) => step.id === 'ability')
    expect(ability).toBeDefined()
    expect(ability?.instruction).toMatch(/Solar Power/)
    expect(ability?.instruction).toMatch(/cannot be passed via eggs/i)
    expect(ability?.instruction).toMatch(/Ability Patch|Ability Capsule/)

    const blocking = ability?.ruleFlags?.filter(
      (flag) => flag.severity === 'blocking',
    )
    expect(blocking?.length).toBeGreaterThan(0)
    expect(plan.steps.find((step) => step.id === 'assemble')).toBeDefined()
    expect(plan.steps.find((step) => step.id === 'nature')?.instruction).toMatch(
      /guarantee/i,
    )
    expect(
      plan.steps.find((step) => step.id === 'egg-move-alternative')?.instruction,
    ).toMatch(/Mirror Herb/)
    expect(plan.steps.find((step) => step.id === 'iv-base')).toBeDefined()
  })

  it('Case 4: genderless + no Ditto truncates with blocked: true', () => {
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
    expect(plan.strategies).toHaveLength(0)

    const [assemble] = plan.steps
    expect(assemble.id).toBe('assemble')
    expect(assemble.instruction).toMatch(/Ditto/i)
    expect(assemble.instruction).toMatch(/not obtainable|unavailable/i)
    expect(plan.steps.some((step) => step.id === 'nature')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'iv-base')).toBe(false)
  })

  it('no power-item requirement → no held-item conflict warning', () => {
    const plan = planDaycare(scarletViolet, gen9, baseTarget)

    const parents = recommendedParents(plan)
    const held = parents.map((parent) => parent.heldItem).filter(Boolean)
    expect(held).toContain('Everstone')
    expect(held).toContain('Destiny Knot')
    expect(held).toHaveLength(2)

    const ivBase = plan.steps.find((step) => step.id === 'iv-base')
    const conflict = ivBase?.ruleFlags?.find(
      (flag) =>
        flag.severity === 'warning' &&
        /Destiny Knot spreads five IVs/i.test(flag.message),
    )
    expect(conflict).toBeUndefined()
    expect(JSON.stringify(ivBase?.ruleFlags ?? [])).not.toMatch(/power item/i)
  })

  it('Ditto strategy appears when egg moves can be consolidated', () => {
    expect(scarletViolet.ditto.available).toBe(true)

    const plan = planDaycare(scarletViolet, gen9, baseTarget)
    const ditto = plan.strategies.find((strategy) => strategy.id === 'ditto-pair')

    expect(ditto).toBeDefined()
    expect(ditto?.recommended).toBeUndefined()
    expect(ditto?.acquisitionCost).toMatch(/Ditto/i)
    expect(ditto?.tradeoff).toMatch(/Mirror Herb|consolidat/i)
    expect(ditto?.tradeoff).toMatch(/Ditto cannot carry egg moves/i)

    const charmander = ditto?.parents.find((parent) =>
      parent.species.includes('Charmander'),
    )
    expect(charmander?.mustKnow).toEqual(
      expect.arrayContaining(['Dragon Dance']),
    )
    expect(charmander?.mustHaveNature).toBe('Timid')

    const dittoParent = ditto?.parents.find((parent) =>
      parent.species.includes('Ditto'),
    )
    expect(dittoParent).toBeDefined()
    expect(
      charmander?.acquisition?.some((flag) =>
        /Mirror Herb|Transform|consolidat/i.test(flag.message),
      ),
    ).toBe(true)
  })

  it('same-species pair forces male on Parent B with a gender reason', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      eggMoves: [],
    })
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(speciesPair?.acquisitionCost).toMatch(
      /two Charmander, one with the target nature/i,
    )
    const parentB = speciesPair?.parents.find((parent) => parent.role === 'B')
    expect(parentB?.species).toEqual(['Charmander'])
    expect(parentB?.gender).toBe('male')
    expect(parentB?.genderReason).toMatch(/can't both be female/i)
    const parentA = speciesPair?.parents.find((parent) => parent.role === 'A')
    expect(parentA?.genderReason).toMatch(
      /female because the female parent determines/i,
    )
    expect(parentA?.genderReason).not.toMatch(/egg-move/i)
  })

  it('Ditto route does not invent a genderReason when gender is not forced', () => {
    const plan = planDaycare(scarletViolet, gen9, baseTarget)
    const ditto = plan.strategies.find((strategy) => strategy.id === 'ditto-pair')
    const charmander = ditto?.parents.find((parent) =>
      parent.species.includes('Charmander'),
    )
    expect(charmander?.gender).toBeUndefined()
    expect(charmander?.genderReason).toBeUndefined()
  })

  it('recommendReason is stated when a single route wins on parent count', () => {
    const plan = planDaycare(scarletViolet, gen9, baseTarget)
    // Tied at two parents each → equivalent, no badge.
    expect(plan.routesEquivalent).toBe(true)
    expect(
      plan.strategies.every(
        (strategy) =>
          strategy.recommended === undefined &&
          strategy.recommendReason === undefined,
      ),
    ).toBe(true)

    const blockedDitto = planDaycare(
      {
        ...scarletViolet,
        ditto: { ...scarletViolet.ditto, available: false },
        species: {
          ...scarletViolet.species,
          Charmander: {
            ...scarletViolet.species.Charmander,
            genderRatio: 'genderless',
          },
        },
      },
      gen9,
      baseTarget,
    )
    expect(blockedDitto.blocked).toBe(true)

    const dittoOnly = planDaycare(
      {
        ...scarletViolet,
        species: {
          ...scarletViolet.species,
          Charmander: {
            ...scarletViolet.species.Charmander,
            genderRatio: 'genderless',
          },
        },
      },
      gen9,
      baseTarget,
    )
    expect(dittoOnly.blocked).toBe(false)
    expect(dittoOnly.strategies).toHaveLength(1)
    expect(dittoOnly.strategies[0]?.recommended).toBe(true)
    expect(dittoOnly.strategies[0]?.recommendReason).toMatch(/only viable/i)
  })

  it('nature requirement carries an acquisition flag on the nature parent', () => {
    const plan = planDaycare(scarletViolet, gen9, baseTarget)
    const natureParent = recommendedParents(plan).find(
      (parent) => parent.mustHaveNature === 'Timid',
    )
    expect(natureParent?.acquisition?.some((flag) =>
      /Acquire a Timid parent/i.test(flag.message),
    )).toBe(true)
  })

  it('Dragon Dance carrier appears in the species-pair strategy', () => {
    const plan = planDaycare(scarletViolet, gen9, baseTarget)
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    const carriers = speciesPair?.parents.flatMap((parent) => parent.species) ?? []
    expect(carriers).toEqual(
      expect.arrayContaining(['Salamence', 'Dragapult', 'Gyarados']),
    )
  })

  it('hidden-ability requirement carries an acquisition flag', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      ability: 'Solar Power',
    })
    const abilityParent = recommendedParents(plan).find(
      (parent) => parent.mustHaveAbility === 'Solar Power',
    )
    expect(
      abilityParent?.acquisition?.some((flag) =>
        /hidden ability/i.test(flag.message),
      ),
    ).toBe(true)
  })

  it('opt-in power item with Everstone + Destiny Knot produces a real conflict warning', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      wantsPowerItem: true,
    })
    const ivBase = plan.steps.find((step) => step.id === 'iv-base')
    const conflict = ivBase?.ruleFlags?.find(
      (flag) =>
        flag.severity === 'warning' &&
        /Destiny Knot spreads five IVs/i.test(flag.message),
    )
    expect(conflict).toBeDefined()
    expect(conflict?.message).toMatch(/power item/i)
  })

  it('all-Any target produces no acquisition flags and no held-item steps', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: {
        hp: 'any',
        atk: 'any',
        def: 'any',
        spa: 'any',
        spd: 'any',
        spe: 'any',
      },
    })

    expect(plan.blocked).toBe(false)
    expect(plan.shiny).toBeDefined()

    for (const strategy of plan.strategies) {
      for (const parent of strategy.parents) {
        expect(parent.acquisition ?? []).toEqual([])
        expect(parent.heldItem).toBeUndefined()
        expect(parent.mustHaveNature).toBeUndefined()
        expect(parent.mustHaveAbility).toBeUndefined()
        expect(parent.mustOriginateFromDifferentLanguage).toBeUndefined()
        expect(parent.gender).toBeUndefined()
        expect(parent.genderReason).toBeUndefined()
      }
    }

    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.id).toBe('assemble')
    expect(plan.steps[0]?.instruction).toMatch(
      /^Pair two Charmander and hatch\. Eggs hatch at level 1\.$/,
    )
    expect(plan.steps.some((step) => step.id === 'nature')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'iv-base')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'ability')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'ability-odds')).toBe(false)
  })

  it('all-Any plus wantsShiny with Masuda adds a different-language parent and recommends Ditto', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: {
        hp: 'any',
        atk: 'any',
        def: 'any',
        spa: 'any',
        spd: 'any',
        spe: 'any',
      },
      wantsShiny: true,
    })

    expect(plan.blocked).toBe(false)
    expect(plan.shiny).toBeDefined()
    expect(plan.routesEquivalent).toBeUndefined()

    const dittoPair = plan.strategies.find(
      (strategy) => strategy.id === 'ditto-pair',
    )
    expect(dittoPair?.recommended).toBe(true)
    expect(dittoPair?.recommendReason).toMatch(
      /A Ditto works with any species/i,
    )
    expect(dittoPair?.acquisitionCost).toMatch(
      /Ditto whose origin language differs from its partner/i,
    )

    const dittoParent = dittoPair?.parents.find((parent) =>
      parent.species.includes('Ditto'),
    )
    expect(dittoParent?.mustOriginateFromDifferentLanguage).toBe(true)
    expect(
      dittoParent?.acquisition?.some((flag) =>
        /already have one/i.test(flag.message),
      ),
    ).toBe(true)

    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.id).toBe('assemble')
    expect(plan.steps[0]?.instruction).toMatch(
      /origin language differs from its partner/i,
    )
    expect(plan.steps.some((step) => step.id === 'nature')).toBe(false)
    expect(plan.steps.some((step) => step.id === 'shiny-charm')).toBe(false)
  })

  it('nature Any with an egg move still forces the carrier gender for the right reason', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      nature: 'any',
      ability: 'any',
    })

    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(speciesPair?.acquisitionCost).not.toMatch(/target nature/i)

    const natureParent = speciesPair?.parents.find(
      (parent) => parent.mustHaveNature,
    )
    expect(natureParent).toBeUndefined()

    const parentA = speciesPair?.parents.find((parent) => parent.role === 'A')
    expect(parentA?.mustHaveNature).toBeUndefined()
    expect(parentA?.heldItem).not.toBe('Everstone')
    expect(parentA?.gender).toBe('female')
    expect(parentA?.genderReason).toMatch(
      /female because the female parent determines/i,
    )

    const moveParent = speciesPair?.parents.find((parent) =>
      parent.mustKnow?.includes('Dragon Dance'),
    )
    expect(moveParent?.gender).toBe('male')
    expect(moveParent?.genderReason).toMatch(
      /male because a female .+ would produce .+ eggs instead/i,
    )
    expect(moveParent?.genderReason).not.toMatch(/can't both be female/i)

    expect(plan.steps.some((step) => step.id === 'nature')).toBe(false)
  })

  it('nature Any with no egg moves drops gender constraints entirely', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      nature: 'any',
      ability: 'any',
      eggMoves: [],
    })
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    for (const parent of speciesPair?.parents ?? []) {
      expect(parent.gender).toBeUndefined()
      expect(parent.genderReason).toBeUndefined()
    }
  })

  it('hidden-ability target excludes species-pair when the carrier must be male', () => {
    const game: GameData = {
      ...scarletViolet,
      species: {
        ...scarletViolet.species,
        Charmander: {
          ...scarletViolet.species.Charmander,
          genderRatio: 'male-only',
        },
      },
    }
    const plan = planDaycare(game, gen9, {
      ...baseTarget,
      nature: 'any',
      ability: 'Solar Power',
      eggMoves: [],
    })

    expect(plan.strategies.some((strategy) => strategy.id === 'species-pair')).toBe(
      false,
    )
    expect(plan.strategies.some((strategy) => strategy.id === 'ditto-only')).toBe(
      true,
    )
    const excluded = plan.excludedStrategies?.find(
      (entry) => entry.id === 'species-pair',
    )
    expect(excluded?.reason).toMatch(/Solar Power/i)
    expect(excluded?.reason).toMatch(/Ditto/i)
    expect(excluded?.reason).toMatch(/male or genderless/i)
  })

  it('ability step quotes standard vs hidden rates', () => {
    const dualStandard: GameData = {
      ...scarletViolet,
      species: {
        ...scarletViolet.species,
        Charmander: {
          ...scarletViolet.species.Charmander,
          abilities: {
            standard: ['Blaze', 'Flash Fire'],
            hidden: 'Solar Power',
          },
        },
      },
    }

    const standard = planDaycare(dualStandard, gen9, {
      ...baseTarget,
      eggMoves: [],
      ability: 'Blaze',
    })
    const standardStep = standard.steps.find((step) => step.id === 'ability')
    expect(standardStep?.instruction).toMatch(/Blaze/)
    expect(standardStep?.instruction).toMatch(/80%/)
    expect(standardStep?.instruction).not.toMatch(/lower rate/i)

    const hidden = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      eggMoves: [],
      ability: 'Solar Power',
    })
    const hiddenStep = hidden.steps.find((step) => step.id === 'ability')
    expect(hiddenStep?.instruction).toMatch(/Solar Power/)
    expect(hiddenStep?.instruction).toMatch(/60%/)
    expect(
      hiddenStep?.ruleFlags?.some((flag) =>
        /lower rate than standard/i.test(flag.message),
      ),
    ).toBe(true)
    // Two-gender Charmander can still use species-pair with a female HA carrier.
    expect(
      hidden.strategies.some((strategy) => strategy.id === 'species-pair'),
    ).toBe(true)
  })

  it('sole standard ability is automatic — no parent requirement, gender, or rate', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      nature: 'any',
      ability: 'Blaze',
      eggMoves: [],
    })

    for (const strategy of plan.strategies) {
      for (const parent of strategy.parents) {
        expect(parent.mustHaveAbility).toBeUndefined()
        expect(parent.genderReason ?? '').not.toMatch(/pass its ability/i)
      }
    }
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(speciesPair?.parents.every((parent) => !parent.gender)).toBe(true)
    expect(plan.steps.some((step) => step.id === 'ability')).toBe(false)
    expect(JSON.stringify(plan.steps)).not.toMatch(/80%/)
  })

  it('Any ability target quotes no inheritance rate', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      ...baseTarget,
      ability: 'any',
      eggMoves: [],
    })
    expect(plan.steps.some((step) => step.id === 'ability')).toBe(false)
    const blob = JSON.stringify(plan.steps)
    expect(blob).not.toMatch(/80%/)
    expect(blob).not.toMatch(/60%/)
  })
})

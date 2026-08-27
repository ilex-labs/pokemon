/**
 * Schema invariant: gender set ⇒ genderReason non-empty.
 * Walks every strategy of every existing engine fixture.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen3Json from '../data/rulesets/gen3.json'
import gen9Json from '../data/rulesets/gen9.json'
import frlgJson from '../data/games/firered-leafgreen.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { planDaycare, type DaycarePlan, type DaycareTarget } from './daycareEngine'

const gen3 = gen3Json as Ruleset
const gen9 = gen9Json as Ruleset
const frlg = frlgJson as GameData
const scarletViolet = scarletVioletJson as GameData

const anyIvs: DaycareTarget['ivs'] = {
  hp: 'any',
  atk: 'any',
  def: 'any',
  spa: 'any',
  spd: 'any',
  spe: 'any',
}

const mixedIvs: DaycareTarget['ivs'] = {
  hp: 31,
  atk: 0,
  def: 31,
  spa: 31,
  spd: 31,
  spe: 31,
}

const allMaxIvs: DaycareTarget['ivs'] = {
  hp: 31,
  atk: 31,
  def: 31,
  spa: 31,
  spd: 31,
  spe: 31,
}

const svBase: DaycareTarget = {
  species: 'Charmander',
  nature: 'Timid',
  ability: 'Blaze',
  eggMoves: ['Dragon Dance'],
  ivs: mixedIvs,
}

const frlgBase: DaycareTarget = {
  species: 'Charmander',
  nature: 'Timid',
  ability: 'Blaze',
  eggMoves: ['Dragon Dance'],
  ivs: allMaxIvs,
}

function fixtureSpecies(name: string) {
  return {
    abilities: { standard: ['FixtureAbility'] },
    genderRatio: { malePercent: 50 as const },
    hatchesInto: name,
    eggCycles: 20,
  }
}

const hatchRoutes: GameData['hatchRoutes'] = [
  { routeName: 'Fixture walk', cycleCount: 'medium', method: 'Walk.' },
]

const fixtureGameSameSpecies: GameData = {
  id: 'fixture-same-species-carrier',
  displayName: 'Fixture same-species carrier',
  generation: 9,
  eggGroups: { field: ['FixtureMon'] },
  species: { FixtureMon: fixtureSpecies('FixtureMon') },
  ditto: {
    available: true,
    universalParent: true,
    obtainedAt: 'Fixture Ditto location.',
  },
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixtureMon'] }],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes,
}

const fixtureGameExternalCarrier: GameData = {
  id: 'fixture-external-carrier',
  displayName: 'Fixture external carrier',
  generation: 9,
  eggGroups: {
    field: ['FixtureMon'],
    dragon: ['FixtureCarrier'],
  },
  species: {
    FixtureMon: fixtureSpecies('FixtureMon'),
    FixtureCarrier: fixtureSpecies('FixtureCarrier'),
  },
  ditto: {
    available: true,
    universalParent: true,
    obtainedAt: 'Fixture Ditto location.',
  },
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixtureCarrier'] }],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes,
}

const fixtureDitto = {
  available: true,
  universalParent: true,
  obtainedAt: 'Fixture Ditto location.',
} as const

const fixtureGameUnknownPasser: GameData = {
  id: 'fixture-unknown-passer',
  displayName: 'Fixture unknown passer',
  generation: 9,
  eggGroups: { field: ['FixtureMon'] },
  species: { FixtureMon: fixtureSpecies('FixtureMon') },
  ditto: fixtureDitto,
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixtureGhost'] }],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes,
}

const fixtureGameCataloguedNoGroups: GameData = {
  id: 'fixture-catalogued-no-groups',
  displayName: 'Fixture catalogued no groups',
  generation: 9,
  eggGroups: { field: ['FixtureMon'] },
  species: {
    FixtureMon: fixtureSpecies('FixtureMon'),
    FixturePasser: fixtureSpecies('FixturePasser'),
  },
  ditto: fixtureDitto,
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixturePasser'] }],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes,
}

const fixtureGameSharedGroupPasser: GameData = {
  id: 'fixture-shared-group-passer',
  displayName: 'Fixture shared group passer',
  generation: 9,
  eggGroups: { field: ['FixtureMon', 'FixturePasser'] },
  species: {
    FixtureMon: fixtureSpecies('FixtureMon'),
    FixturePasser: fixtureSpecies('FixturePasser'),
  },
  ditto: fixtureDitto,
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixturePasser'] }],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes,
}

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

const maleOnlyCharmander: GameData = {
  ...scarletViolet,
  species: {
    ...scarletViolet.species,
    Charmander: {
      ...scarletViolet.species.Charmander,
      genderRatio: 'male-only',
    },
  },
}

const genderlessCharmander: GameData = {
  ...scarletViolet,
  species: {
    ...scarletViolet.species,
    Charmander: {
      ...scarletViolet.species.Charmander,
      genderRatio: 'genderless',
    },
  },
}

const genderlessNoDitto: GameData = {
  ...genderlessCharmander,
  ditto: { ...scarletViolet.ditto, available: false },
}

const noHyperAccess: GameData = (() => {
  const { hyperTrainingAccess: _omit, ...rest } = scarletViolet
  return rest
})()

const maleOnlyRuleset = {
  ...gen9,
  eggMoveEligibleParents: 'male-only',
} as Ruleset

const hiddenCannotPass: Ruleset = {
  ...gen9,
  abilityInheritance: {
    ...gen9.abilityInheritance,
    hiddenAbilityViaEggs: false,
  },
}

const chanceRuleset: Ruleset = {
  ...gen9,
  natureLock: { method: 'everstone-chance', holder: 'either-parent' },
}

const holderFemaleOrDitto: Ruleset = {
  ...gen9,
  natureLock: { method: 'everstone-chance', holder: 'female-or-ditto' },
}

const fixtureOdds: Ruleset = {
  ...gen9,
  abilityInheritance: {
    ...gen9.abilityInheritance,
    inheritanceExists: true,
    standardOdds: 0.5,
    hiddenOdds: 0.25,
  },
}

const fixtureLevel100: Ruleset = {
  ...gen9,
  hyperTraining: { available: true, levelRequired: 100 },
}

const fixtureMasuda: Ruleset = {
  ...gen9,
  masudaMethod: { odds: '4/4096', approximateEggs: 1024 },
}

const fixtureIvCounts: Ruleset = {
  ...gen9,
  ivInheritance: {
    ...gen9.ivInheritance,
    baseCountInherited: 2,
    destinyKnotBoostedCount: 4,
  },
}

const fixtureMoveTarget: DaycareTarget = {
  species: 'FixtureMon',
  nature: 'any',
  ability: 'any',
  eggMoves: ['FixtureMove'],
  ivs: anyIvs,
}

const natureOnly: DaycareTarget = {
  species: 'Charmander',
  nature: 'Timid',
  ability: 'any',
  eggMoves: [],
  ivs: anyIvs,
}

type Case = {
  name: string
  game: GameData
  ruleset: Ruleset
  target: DaycareTarget
}

const cases: Case[] = [
  { name: 'SV Case 1 base', game: scarletViolet, ruleset: gen9, target: svBase },
  {
    name: 'SV wantsShiny',
    game: scarletViolet,
    ruleset: gen9,
    target: { ...svBase, wantsShiny: true },
  },
  {
    name: 'SV hiddenAbilityViaEggs false / Solar Power',
    game: scarletViolet,
    ruleset: hiddenCannotPass,
    target: { ...svBase, ability: 'Solar Power' },
  },
  {
    name: 'SV genderless no Ditto',
    game: genderlessNoDitto,
    ruleset: gen9,
    target: svBase,
  },
  {
    name: 'SV genderless ditto-only',
    game: genderlessCharmander,
    ruleset: gen9,
    target: svBase,
  },
  {
    name: 'SV wantsPowerItem',
    game: scarletViolet,
    ruleset: gen9,
    target: { ...svBase, wantsPowerItem: true },
  },
  {
    name: 'SV same-species nature pair',
    game: scarletViolet,
    ruleset: gen9,
    target: { ...svBase, eggMoves: [] },
  },
  {
    name: 'SV nature any with egg moves',
    game: scarletViolet,
    ruleset: gen9,
    target: { ...svBase, nature: 'any', ability: 'any' },
  },
  {
    name: 'SV all-any',
    game: scarletViolet,
    ruleset: gen9,
    target: {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: anyIvs,
    },
  },
  {
    name: 'SV everstone-chance',
    game: scarletViolet,
    ruleset: chanceRuleset,
    target: { ...svBase, eggMoves: [], ivs: anyIvs },
  },
  {
    name: 'SV female-or-ditto holder',
    game: scarletViolet,
    ruleset: holderFemaleOrDitto,
    target: natureOnly,
  },
  {
    name: 'SV Solar Power',
    game: scarletViolet,
    ruleset: gen9,
    target: { ...svBase, eggMoves: [], ability: 'Solar Power' },
  },
  {
    name: 'SV male-only Solar Power',
    game: maleOnlyCharmander,
    ruleset: gen9,
    target: {
      ...svBase,
      nature: 'any',
      ability: 'Solar Power',
      eggMoves: [],
    },
  },
  {
    name: 'SV dual-standard Blaze',
    game: dualStandard,
    ruleset: gen9,
    target: { ...svBase, eggMoves: [], ability: 'Blaze' },
  },
  {
    name: 'SV dual-standard synthetic odds',
    game: dualStandard,
    ruleset: fixtureOdds,
    target: {
      species: 'Charmander',
      nature: 'any',
      ability: 'Blaze',
      eggMoves: [],
      ivs: anyIvs,
    },
  },
  {
    name: 'SV Solar Power synthetic odds',
    game: scarletViolet,
    ruleset: fixtureOdds,
    target: {
      species: 'Charmander',
      nature: 'any',
      ability: 'Solar Power',
      eggMoves: [],
      ivs: anyIvs,
    },
  },
  {
    name: 'SV hyper level 100',
    game: scarletViolet,
    ruleset: fixtureLevel100,
    target: {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: allMaxIvs,
    },
  },
  {
    name: 'SV hyper no-access',
    game: noHyperAccess,
    ruleset: fixtureLevel100,
    target: {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: allMaxIvs,
    },
  },
  {
    name: 'SV synthetic Masuda',
    game: scarletViolet,
    ruleset: fixtureMasuda,
    target: {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: anyIvs,
      wantsShiny: true,
    },
  },
  {
    name: 'SV synthetic IV counts',
    game: scarletViolet,
    ruleset: fixtureIvCounts,
    target: {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: mixedIvs,
    },
  },
  { name: 'FRLG base', game: frlg, ruleset: gen3, target: frlgBase },
  {
    name: 'FRLG unconstrained',
    game: frlg,
    ruleset: gen3,
    target: {
      ...frlgBase,
      eggMoves: [],
      nature: 'any',
      ivs: anyIvs,
    },
  },
  {
    name: 'FRLG wantsShiny',
    game: frlg,
    ruleset: gen3,
    target: { ...frlgBase, wantsShiny: true },
  },
  {
    name: 'FRLG wantsPowerItem',
    game: frlg,
    ruleset: gen3,
    target: { ...frlgBase, wantsPowerItem: true },
  },
  {
    name: 'same-species carrier gen9',
    game: fixtureGameSameSpecies,
    ruleset: gen9,
    target: fixtureMoveTarget,
  },
  {
    name: 'same-species carrier male-only',
    game: fixtureGameSameSpecies,
    ruleset: maleOnlyRuleset,
    target: fixtureMoveTarget,
  },
  {
    name: 'external carrier male-only',
    game: fixtureGameExternalCarrier,
    ruleset: maleOnlyRuleset,
    target: fixtureMoveTarget,
  },
  {
    name: 'loud-lookups unknown passer',
    game: fixtureGameUnknownPasser,
    ruleset: gen9,
    target: fixtureMoveTarget,
  },
  {
    name: 'loud-lookups catalogued empty',
    game: fixtureGameCataloguedNoGroups,
    ruleset: gen9,
    target: fixtureMoveTarget,
  },
  {
    name: 'loud-lookups shared group',
    game: fixtureGameSharedGroupPasser,
    ruleset: gen9,
    target: fixtureMoveTarget,
  },
]

function violations(label: string, plan: DaycarePlan): string[] {
  const found: string[] = []
  for (const strategy of plan.strategies) {
    for (const parent of strategy.parents) {
      if (
        parent.gender != null &&
        !(parent.genderReason && parent.genderReason.length > 0)
      ) {
        found.push(
          `${label} / ${strategy.id} / parent ${parent.role} gender=${parent.gender}`,
        )
      }
    }
  }
  return found
}

describe('gender set implies genderReason', () => {
  it('holds on every strategy of every existing fixture', () => {
    const found: string[] = []
    for (const entry of cases) {
      const plan = planDaycare(entry.game, entry.ruleset, entry.target)
      found.push(...violations(entry.name, plan))
    }
    expect(found).toEqual([])
  })
})

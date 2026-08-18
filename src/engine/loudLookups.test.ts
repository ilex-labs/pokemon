import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen9 = gen9Json as Ruleset

const fixtureTarget: DaycareTarget = {
  species: 'FixtureMon',
  nature: 'any',
  ability: 'any',
  eggMoves: ['FixtureMove'],
  ivs: {
    hp: 31,
    atk: 31,
    def: 31,
    spa: 31,
    spd: 31,
    spe: 31,
  },
}

function fixtureSpecies(name: string) {
  return {
    abilities: { standard: ['FixtureAbility'] },
    genderRatio: { malePercent: 50 },
    hatchesInto: name,
    eggCycles: 20,
  }
}

const hatchRoutes: GameData['hatchRoutes'] = [
  {
    routeName: 'Fixture walk',
    cycleCount: 'medium',
    method: 'Walk.',
  },
]

const fixtureBase = {
  generation: 9,
  ditto: {
    available: true,
    universalParent: true,
    obtainedAt: 'Fixture Ditto location.',
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes,
} satisfies Partial<GameData>

/** Passer named in the catalog but missing from the egg-group index. */
const fixtureGameUnknownPasser: GameData = {
  ...fixtureBase,
  id: 'fixture-unknown-passer',
  displayName: 'Fixture unknown passer',
  eggGroups: { field: ['FixtureMon'] },
  species: { FixtureMon: fixtureSpecies('FixtureMon') },
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixtureGhost'] }],
  },
}

/**
 * Passer is a species key with no membership — the other empty-lookup
 * message. Same step list as unknown: we cannot assert a chain.
 */
const fixtureGameCataloguedNoGroups: GameData = {
  ...fixtureBase,
  id: 'fixture-catalogued-no-groups',
  displayName: 'Fixture catalogued no groups',
  eggGroups: { field: ['FixtureMon'] },
  species: {
    FixtureMon: fixtureSpecies('FixtureMon'),
    FixturePasser: fixtureSpecies('FixturePasser'),
  },
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixturePasser'] }],
  },
}

/** Passer in the index, sharing a group with the target. */
const fixtureGameSharedGroupPasser: GameData = {
  ...fixtureBase,
  id: 'fixture-shared-group-passer',
  displayName: 'Fixture shared group passer',
  eggGroups: { field: ['FixtureMon', 'FixturePasser'] },
  species: {
    FixtureMon: fixtureSpecies('FixtureMon'),
    FixturePasser: fixtureSpecies('FixturePasser'),
  },
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixturePasser'] }],
  },
}

function eggMoveParent(game: GameData) {
  const plan = planDaycare(game, gen9, fixtureTarget)
  const speciesPair = plan.strategies.find(
    (strategy) => strategy.id === 'species-pair',
  )
  const parent = speciesPair?.parents.find((entry) =>
    entry.mustKnow?.includes('FixtureMove'),
  )
  return { plan, parent }
}

function eggGroupWarnings(parent: ReturnType<typeof eggMoveParent>['parent']) {
  return (
    parent?.acquisition?.filter(
      (flag) =>
        flag.severity === 'warning' && /egg-group/i.test(flag.message),
    ) ?? []
  )
}

describe('loud egg-group lookups', () => {
  it('fixtureGameUnknownPasser: warning names the absent passer', () => {
    const { plan, parent } = eggMoveParent(fixtureGameUnknownPasser)
    expect(plan.blocked).toBe(false)
    expect(eggGroupWarnings(parent)).toEqual([
      {
        severity: 'warning',
        message: 'no egg-group data is held for FixtureGhost',
      },
    ])
  })

  it('fixtureGameCataloguedNoGroups: warning names the empty membership', () => {
    const { plan, parent } = eggMoveParent(fixtureGameCataloguedNoGroups)
    expect(plan.blocked).toBe(false)
    expect(eggGroupWarnings(parent)).toEqual([
      {
        severity: 'warning',
        message:
          'FixturePasser is in the catalog but has no egg-group membership recorded',
      },
    ])
  })

  it('fixtureGameSharedGroupPasser: no egg-group warning', () => {
    const { plan, parent } = eggMoveParent(fixtureGameSharedGroupPasser)
    expect(plan.blocked).toBe(false)
    expect(eggGroupWarnings(parent)).toEqual([])
  })

  it('unknown passer and shared-group passer produce the same step list', () => {
    const unknown = eggMoveParent(fixtureGameUnknownPasser).plan
    const shared = eggMoveParent(fixtureGameSharedGroupPasser).plan
    expect(unknown.steps.length).toBeGreaterThan(0)
    expect(unknown.steps).toEqual(shared.steps)
  })
})

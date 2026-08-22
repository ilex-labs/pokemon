import { describe, expect, it } from 'vitest'
import { formatReason, formatReasons, type Reason } from './reason'

describe('formatReason', () => {
  it('female-species-holder names the offspring species', () => {
    expect(
      formatReason({
        code: 'female-species-holder',
        offspringSpecies: 'Charmander',
      }),
    ).toBe(
      "Female because the female parent determines the offspring's species — eggs hatch as Charmander.",
    )
  })

  it('female-ability-needs-ditto', () => {
    expect(formatReason({ code: 'female-ability-needs-ditto' })).toBe(
      'Female because a male or genderless parent can only pass its ability when paired with Ditto.',
    )
  })

  it('male-same-species-partner', () => {
    expect(formatReason({ code: 'male-same-species-partner' })).toBe(
      "Male because the pair can't both be female.",
    )
  })

  it('male-external-carrier with one species names it twice', () => {
    expect(
      formatReason({
        code: 'male-external-carrier',
        carrierSpecies: ['FixtureCarrier'],
      }),
    ).toBe(
      'Male because a female FixtureCarrier would produce FixtureCarrier eggs instead.',
    )
  })

  it('male-external-carrier with several species uses a list', () => {
    expect(
      formatReason({
        code: 'male-external-carrier',
        carrierSpecies: ['Salamence', 'Dragapult', 'Gyarados'],
      }),
    ).toBe(
      'Male because a female of that species (Salamence, Dragapult, or Gyarados) would produce its own eggs instead.',
    )
  })

  it('male-egg-move-eligible is the father-passes rule', () => {
    expect(formatReason({ code: 'male-egg-move-eligible' })).toBe(
      'Male because only the father passes egg moves in this game.',
    )
  })

  it('everstone-guaranteed names the nature', () => {
    expect(
      formatReason({ code: 'everstone-guaranteed', nature: 'Timid' }),
    ).toBe('Guarantees the hatch inherits Timid.')
  })

  it('everstone-chance hedges the same nature', () => {
    expect(
      formatReason({ code: 'everstone-chance', nature: 'Timid' }),
    ).toBe('Gives a 50% chance the hatch inherits Timid.')
  })

  it('destiny-knot-iv names the inherited counts', () => {
    expect(
      formatReason({
        code: 'destiny-knot-iv',
        baseCountInherited: 3,
        destinyKnotBoostedCount: 5,
      }),
    ).toBe(
      'Serves the IV target — raises inherited IVs from 3 to 5.',
    )
  })

  it('power-item-iv locks one stat', () => {
    expect(formatReason({ code: 'power-item-iv' })).toBe(
      'Serves the IV target — locks one specific parent IV into the hatch.',
    )
  })
})

describe('formatReasons', () => {
  it('joins two reasons with a space', () => {
    const reasons: Reason[] = [
      {
        code: 'male-external-carrier',
        carrierSpecies: ['FixtureCarrier'],
      },
      { code: 'male-egg-move-eligible' },
    ]
    expect(formatReasons(reasons)).toBe(
      'Male because a female FixtureCarrier would produce FixtureCarrier eggs instead. Male because only the father passes egg moves in this game.',
    )
  })
})

import { describe, expect, it } from 'vitest'
import type { Ruleset } from '../data/schema'
import { frlg, gen3, gen9, scarletViolet } from '../data/unwrapped'
import { formatHatchOutcome } from './hatchOutcome'
import type { GameData } from '../data/schema'

const EVOLVE_GYARADOS =
  'If you need Gyarados specifically, hatch Magikarp and evolve it.'

describe('formatHatchOutcome', () => {
  it('FRLG Charmander hatches at level 5', () => {
    expect(
      formatHatchOutcome(gen3, frlg.species.Charmander!, 'Charmander'),
    ).toBe('Eggs hatch as Charmander at level 5.')
  })

  it('SV Charmander hatches at level 1 with no evolve clause', () => {
    const sentence = formatHatchOutcome(
      gen9,
      scarletViolet.species.Charmander!,
      'Charmander',
    )
    expect(sentence).toBe('Eggs hatch as Charmander at level 1.')
    expect(sentence).not.toContain('evolve')
  })

  it('FRLG Gyarados names Magikarp as the hatch, not Gyarados', () => {
    expect(
      formatHatchOutcome(gen3, frlg.species.Gyarados!, 'Gyarados'),
    ).toBe(
      `Eggs hatch as Magikarp at level 5. ${EVOLVE_GYARADOS}`,
    )
  })

  it('FRLG Gyarados evolve addendum names evolving Magikarp into Gyarados', () => {
    expect(
      formatHatchOutcome(gen3, frlg.species.Gyarados!, 'Gyarados'),
    ).toContain(EVOLVE_GYARADOS)
  })
})

import { describe, expect, it } from 'vitest'
import type { GameData } from '../src/data/schema'
import frlgJson from '../src/data/games/firered-leafgreen.json'
import {
  modifierSingleSourceErrors,
  provenanceEntryErrors,
} from './validate-data.mjs'

const frlg = frlgJson as GameData
const bicycle = frlg.eggEfficiencyModifiers?.[0]

describe('egg-efficiency one-source carve-out', () => {
  it('FRLG bicycle declares bulbapedia plus a reason and has no digits', () => {
    expect(bicycle?.name).toBe('Bicycle')
    expect(bicycle?.singleSource).toBe('bulbapedia')
    expect(bicycle?.singleSourceReason).toMatch(/self-evident in play/i)
    expect(bicycle?.singleSourceReason).toMatch(/not a rate/i)
    expect(modifierSingleSourceErrors('firered-leafgreen', 0, bicycle)).toEqual(
      [],
    )
  })

  it('rejects a single source with no reason', () => {
    const errors = modifierSingleSourceErrors('firered-leafgreen', 0, {
      ...bicycle,
      singleSourceReason: undefined,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/singleSource requires singleSourceReason/)
  })

  it('rejects a single source whose effect contains a number', () => {
    const errors = modifierSingleSourceErrors('firered-leafgreen', 0, {
      ...bicycle,
      effect: `${bicycle?.effect} About 2× walking pace.`,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/cannot contain a number in effect or availability/)
  })

  it('rejects a reason on a row that is already two-sourced', () => {
    const { singleSource: _omit, ...twoSourced } = bicycle ?? {}
    const errors = modifierSingleSourceErrors('firered-leafgreen', 0, {
      ...twoSourced,
      singleSourceReason: bicycle?.singleSourceReason,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/already under the two-source bar/)
  })
})

describe('provenance single-lineage note', () => {
  it('accepts one allowlisted source when a note is present', () => {
    expect(
      provenanceEntryErrors(
        'scarlet-violet',
        'shinyCharmOdds',
        ['bulbapedia'],
        'Single source: Bulbapedia.',
      ),
    ).toEqual([])
  })

  it('rejects one source with no note', () => {
    const errors = provenanceEntryErrors(
      'scarlet-violet',
      'shinyCharmOdds',
      ['bulbapedia'],
      undefined,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(
      /provenance.shinyCharmOdds has a single source and requires provenanceNotes.shinyCharmOdds/,
    )
  })
})

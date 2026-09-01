import { describe, expect, it } from 'vitest'
import frlgJson from '../src/data/games/firered-leafgreen.json'
import svJson from '../src/data/games/scarlet-violet.json'
import {
  gameProvenanceErrors,
  isSourcedLeaf,
  KNOWN_UNSOURCED,
} from './validate-data.mjs'

const frlg = frlgJson as Record<string, unknown>
const sv = svJson as Record<string, unknown>
const bicycle = (frlg.eggEfficiencyModifiers as Record<string, unknown>[])[0]
const bicycleEffect = bicycle.effect as { value: string; src: string[]; note: string }

describe('inline provenance — bicycle conversion', () => {
  it('FRLG bicycle effect is single-lineage with the converted note, and availability is gone', () => {
    expect(bicycle.name).toBe('Bicycle')
    expect(bicycleEffect.src).toEqual(['bulbapedia'])
    expect(bicycleEffect.note).toMatch(/self-evident in play/i)
    expect(bicycleEffect.note).toMatch(/not a rate/i)
    expect(bicycle).not.toHaveProperty('availability')
    expect(bicycle).not.toHaveProperty('singleSource')
    expect(bicycle).not.toHaveProperty('singleSourceReason')
    expect(gameProvenanceErrors('firered-leafgreen', frlg).errors).toEqual([])
  })
})

describe('fail-closed provenance walk', () => {
  it('shipped games only leave the review-list claims unsourced', () => {
    const frlgWalk = gameProvenanceErrors('firered-leafgreen', frlg)
    const svWalk = gameProvenanceErrors('scarlet-violet', sv)
    expect(frlgWalk.errors).toEqual([])
    expect(svWalk.errors).toEqual([])
    expect(frlgWalk.unsourced.sort()).toEqual([
      'generation',
      'noEggRateBoostsReason',
    ])
    expect(svWalk.unsourced).toEqual(['generation'])
    expect(
      [...frlgWalk.unsourced.map((p) => `firered-leafgreen:${p}`), ...svWalk.unsourced.map((p) => `scarlet-violet:${p}`)].sort(),
    ).toEqual([...KNOWN_UNSOURCED].sort())
  })

  it('rejects a new claim leaf with no provenance', () => {
    const clone = structuredClone(sv) as Record<string, unknown>
    const ditto = clone.ditto as Record<string, unknown>
    ditto.region = 'Paldea'
    const errors = gameProvenanceErrors('scarlet-violet', clone).errors
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe(
      'scarlet-violet: ditto.region is a claim and must carry provenance (src: two lineages, or one plus note)',
    )
  })

  it('rejects stripping provenance from an existing claim leaf', () => {
    const clone = structuredClone(sv) as Record<string, unknown>
    const ditto = clone.ditto as Record<string, unknown>
    ditto.available = true
    const errors = gameProvenanceErrors('scarlet-violet', clone).errors
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe(
      'scarlet-violet: ditto.available is a claim and must carry provenance (src: two lineages, or one plus note)',
    )
  })

  it('rejects a single lineage with no note', () => {
    const clone = structuredClone(sv) as Record<string, unknown>
    const mods = clone.shinyEggModifiers as Record<string, unknown>
    const charmOdds = mods.shinyCharmOdds as Record<string, unknown>
    const odds = charmOdds.odds as { value: string; src: string[]; note?: string }
    delete odds.note
    expect(isSourcedLeaf(odds)).toBe(true)
    const errors = gameProvenanceErrors('scarlet-violet', clone).errors
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe(
      'scarlet-violet: shinyEggModifiers.shinyCharmOdds.odds has a single source and requires a note',
    )
  })
})

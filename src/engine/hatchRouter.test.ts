import { describe, expect, it } from 'vitest'
import type { GameData } from '../data/schema'
import frlgJson from '../data/games/firered-leafgreen.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { buildHatchEfficiency } from './hatchRouter'

const scarletViolet = scarletVioletJson as GameData
const frlg = frlgJson as GameData

describe('hatchRouter', () => {
  it('surfaces exampleHolders for ability modifiers on the hatch-speed lever', () => {
    const ability = scarletViolet.eggEfficiencyModifiers?.find(
      (modifier) => modifier.type === 'ability',
    )
    expect(ability?.exampleHolders).toEqual([
      {
        species: 'Larvesta',
        place: 'Asado Desert',
        abilities: ['Flame Body'],
        external: true,
      },
      {
        species: 'Fletchinder',
        place:
          'South Province (Areas One, Three–Five) and West Province Area Three',
        abilities: ['Flame Body'],
        external: true,
      },
      {
        species: 'Carkol',
        place: 'East Province Area Three',
        abilities: ['Steam Engine', 'Flame Body'],
        external: true,
      },
      {
        species: 'Camerupt',
        place: 'Area Zero and North Province Area Two',
        abilities: ['Magma Armor'],
        external: true,
      },
    ])

    const view = buildHatchEfficiency(scarletViolet)
    const flame = view.hatchSpeed.find((line) =>
      /Flame Body/i.test(line.name),
    )
    expect(flame?.exampleHolders).toEqual(ability?.exampleHolders)
    const carkol = flame?.exampleHolders?.find(
      (holder) => holder.species === 'Carkol',
    )
    expect(carkol?.abilities).toEqual(['Steam Engine', 'Flame Body'])
    expect(carkol?.place).toBe('East Province Area Three')
  })

  it('FRLG has no egg-rate boosts and states that as a fact, not a data gap', () => {
    expect(frlg.noEggRateBoostsReason).toMatch(/no item or charm/i)
    expect(frlg.hatchMechanicExplainer).toMatch(/Four Island Day Care/i)
    const view = buildHatchEfficiency(frlg)
    expect(view.eggRate).toEqual([])
    expect(view.hatchSpeed.some((line) => /Flame Body/i.test(line.name))).toBe(
      false,
    )
    expect(view.hatchSpeed.some((line) => /Overworld/i.test(line.name))).toBe(
      true,
    )
    expect(view.stepPace.map((line) => line.name)).toEqual(['Bicycle'])
    expect(view.stepPace[0]?.effect).toMatch(/same steps/i)
    expect(view.stepPace[0]?.effect).toMatch(/less real time/i)
    expect(view.stepPace[0]?.effect).not.toMatch(/\d/)
  })

  it('SV ride legendary is step-pace: same steps, less time — not fewer hatch steps', () => {
    const ride = scarletViolet.eggEfficiencyModifiers?.find((modifier) =>
      /Koraidon|Miraidon/.test(modifier.name),
    )
    expect(ride?.affects).toEqual(['step-pace'])
    expect(ride?.effect).toMatch(/ride legendary|steps taken/i)
    expect(ride?.availability).toMatch(/climbing|gliding|flying/i)
    expect(ride?.availability).toMatch(/non-egg/i)
    expect(JSON.stringify(ride)).not.toMatch(/companion|outside its ball|Let.?s Go/i)
    expect(scarletViolet.hatchRoutes).toEqual([])

    const view = buildHatchEfficiency(scarletViolet)
    expect(
      view.hatchSpeed.some((line) => /Koraidon|Miraidon/.test(line.name)),
    ).toBe(false)
    const line = view.stepPace.find((entry) =>
      /Koraidon|Miraidon/.test(entry.name),
    )
    expect(line?.effect).toMatch(/ride legendary|steps taken/i)
    expect(line?.availability).toMatch(/stay on the ground/i)
    expect(line?.effect).not.toMatch(/companion|outside its ball/i)
  })
})

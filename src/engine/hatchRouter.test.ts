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
  })

  it('SV hatch route is ride-legendary travel, not Lets Go companion mode', () => {
    const route = scarletViolet.hatchRoutes[0]
    expect(route?.routeName).toMatch(/Koraidon|Miraidon/)
    expect(route?.method).toMatch(/ride legendary|steps taken/i)
    expect(route?.notes).toMatch(/climbing|gliding|flying/i)
    expect(route?.notes).toMatch(/non-egg/i)
    expect(JSON.stringify(route)).not.toMatch(/companion|outside its ball|Let.?s Go/i)

    const view = buildHatchEfficiency(scarletViolet)
    const ride = view.hatchSpeed.find((line) => /Koraidon|Miraidon/.test(line.name))
    expect(ride?.effect).toMatch(/stay on the ground/i)
    expect(ride?.effect).not.toMatch(/companion|outside its ball/i)
  })
})

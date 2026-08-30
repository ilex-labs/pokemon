import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GameData } from '../../data/schema'
import scarletVioletJson from '../../data/games/scarlet-violet.json'
import HatchRouteCard from './HatchRouteCard'

const scarletViolet = scarletVioletJson as GameData

describe('HatchRouteCard ability holders', () => {
  it('groups Carkol under both Steam Engine and Flame Body from abilities[]', () => {
    render(<HatchRouteCard game={scarletViolet} />)

    const flame = screen.getByText('Flame Body')
    const steam = screen.getByText('Steam Engine')
    const magma = screen.getByText('Magma Armor')
    expect(flame).toBeTruthy()
    expect(steam).toBeTruthy()
    expect(magma).toBeTruthy()

    const carkols = screen.getAllByText('Carkol')
    expect(carkols).toHaveLength(2)

    expect(screen.getByText('Larvesta')).toBeTruthy()
    expect(screen.getByText('Asado Desert')).toBeTruthy()
    expect(screen.getByText('Fletchinder')).toBeTruthy()
    expect(
      screen.getByText(
        'South Province (Areas One, Three–Five) and West Province Area Three',
      ),
    ).toBeTruthy()
    expect(screen.getAllByText('East Province Area Three')).toHaveLength(2)
    expect(screen.getByText('Camerupt')).toBeTruthy()
    expect(screen.getByText('Area Zero and North Province Area Two')).toBeTruthy()
  })
})

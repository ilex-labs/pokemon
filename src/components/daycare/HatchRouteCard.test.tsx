import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { frlg, scarletViolet } from '../../data/unwrapped'
import HatchRouteCard from './HatchRouteCard'

afterEach(() => {
  cleanup()
})

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

    expect(screen.getByText('Covering the steps faster')).toBeTruthy()
    expect(screen.getByText('Ride Koraidon / Miraidon')).toBeTruthy()
  })
})

describe('HatchRouteCard FRLG step-pace', () => {
  it('shows a sourced egg-rate absence as body copy and the bicycle under covering-steps', () => {
    render(<HatchRouteCard game={frlg} />)

    const absence = screen.getByText(
      /This game has no item or charm that raises how often eggs appear/,
    )
    expect(absence.className).not.toMatch(/text-muted/)

    expect(screen.getByText('Covering the steps faster')).toBeTruthy()
    expect(screen.getByText('Bicycle')).toBeTruthy()
    expect(
      screen.getByText(
        /Covering those same steps on a bicycle takes less real time than walking/,
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText(
        'Not recorded yet. No faster way to cover the same steps.',
      ),
    ).toBeNull()
    expect(screen.getByText('Overworld walking')).toBeTruthy()
  })
})

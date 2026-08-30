import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_FACTS_KEY } from '../lib/playerFactsStorage'
import Daycare from './Daycare'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key) {
      return map.get(key) ?? null
    },
    key(index) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key) {
      map.delete(key)
    },
    setItem(key, value) {
      map.set(key, value)
    },
  }
}

function openPlan() {
  fireEvent.click(screen.getByRole('tab', { name: 'Plan' }))
}

function openTarget() {
  fireEvent.click(screen.getByRole('tab', { name: 'Target' }))
}

/**
 * Wrapping <label> text includes the selected nature's description once a
 * nature is set, so getByLabelText('Nature') only works from "Any".
 */
function changeNature(value: string) {
  openTarget()
  const heading = screen.getByText('Nature', { selector: 'span.label-caps' })
  const select = heading.parentElement?.querySelector('select')
  if (!select) throw new Error('Nature select not found')
  fireEvent.change(select, { target: { value } })
}

function pickGame(id: string) {
  fireEvent.change(screen.getByLabelText('Game'), {
    target: { value: id },
  })
}

describe('Daycare owns-ditto', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  afterEach(() => {
    cleanup()
  })

  it('hides the toggle on an unconstrained plan and shows it when Ditto is sourced', () => {
    render(<Daycare />)
    pickGame('scarlet-violet')
    openPlan()
    expect(
      screen.queryByRole('checkbox', { name: 'I already have Ditto' }),
    ).toBeNull()

    changeNature('Timid')
    openPlan()
    expect(
      screen.getByRole('checkbox', { name: 'I already have Ditto' }),
    ).toBeTruthy()
  })

  it('strikes Obtain Ditto without removing it, and keeps the claim across target, route, and game changes', () => {
    const storage = window.localStorage
    render(<Daycare />)
    pickGame('scarlet-violet')
    changeNature('Timid')
    openPlan()

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'I already have Ditto' }),
    )
    const line = screen.getByText(/Obtain Ditto:/)
    expect(line.className).toMatch(/line-through/)
    expect(line.textContent).toMatch(/Obtain Ditto:/)

    changeNature('Modest')
    openPlan()
    expect(
      (screen.getByRole('checkbox', { name: 'I already have Ditto' }) as HTMLInputElement)
        .checked,
    ).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: /Species pair/ }))
    expect(
      screen.queryByRole('checkbox', { name: 'I already have Ditto' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Ditto pair/ }))
    expect(
      (screen.getByRole('checkbox', { name: 'I already have Ditto' }) as HTMLInputElement)
        .checked,
    ).toBe(true)

    const factsAfterTarget = storage.getItem(PLAYER_FACTS_KEY)
    expect(factsAfterTarget).toMatch(/owns-ditto/)
    expect(factsAfterTarget).toMatch(/scarlet-violet/)

    pickGame('firered-leafgreen')
    expect(storage.getItem(PLAYER_FACTS_KEY)).toMatch(/scarlet-violet/)
    expect(storage.getItem(PLAYER_FACTS_KEY)).toMatch(/owns-ditto/)
    expect(storage.getItem('pokemon:daycare:v1')).not.toMatch(/scarlet-violet/)

    pickGame('scarlet-violet')
    changeNature('Timid')
    openPlan()
    expect(
      (screen.getByRole('checkbox', { name: 'I already have Ditto' }) as HTMLInputElement)
        .checked,
    ).toBe(true)
  })

  it('does not show the toggle on a Masuda Ditto route', () => {
    render(<Daycare />)
    pickGame('scarlet-violet')
    changeNature('Timid')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hatch for shiny' }))
    openPlan()
    expect(
      screen.queryByRole('checkbox', { name: 'I already have Ditto' }),
    ).toBeNull()
  })
})

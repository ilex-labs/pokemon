import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Daycare from '../routes/Daycare'

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

describe('Daycare hatchOutcome on screen', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('shows the FRLG hatch sentence when the plan has no steps', () => {
    render(<Daycare />)

    fireEvent.change(screen.getByLabelText('Game'), {
      target: { value: 'firered-leafgreen' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }))

    expect(
      screen.getByText((_, node) => {
        if (node?.textContent !== 'Eggs hatch as Charmander at level 5.') {
          return false
        }
        return !Array.from(node.children).some(
          (child) => child.textContent === 'Eggs hatch as Charmander at level 5.',
        )
      }),
    ).toBeTruthy()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('Daycare owned-parent checklist', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('unchecks Parent A when the nature behind that letter changes', () => {
    render(<Daycare />)

    fireEvent.change(screen.getByLabelText('Game'), {
      target: { value: 'scarlet-violet' },
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }))
    const [parentA] = screen.getAllByRole('checkbox', {
      name: 'I already have this',
    })
    fireEvent.click(parentA!)
    expect((parentA as HTMLInputElement).checked).toBe(true)

    fireEvent.click(screen.getByRole('tab', { name: 'Target' }))
    fireEvent.change(screen.getByLabelText('Nature'), {
      target: { value: 'Timid' },
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }))
    const [parentAAfter] = screen.getAllByRole('checkbox', {
      name: 'I already have this',
    })
    expect((parentAAfter as HTMLInputElement).checked).toBe(false)
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function Smoke() {
  return <p>harness ok</p>
}

describe('component test harness', () => {
  it('renders in jsdom', () => {
    render(<Smoke />)
    expect(screen.getByText('harness ok')).toBeTruthy()
  })
})

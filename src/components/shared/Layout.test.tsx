import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BUILD_SHA } from '../../lib/buildSha'
import Layout from './Layout'

afterEach(() => {
  cleanup()
})

describe('build SHA stamp', () => {
  it('renders the injected build constant in the footer', () => {
    expect(BUILD_SHA.length).toBeGreaterThan(0)

    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<span />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(`build ${BUILD_SHA}`)).toBeTruthy()
  })
})

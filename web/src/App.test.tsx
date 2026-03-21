import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('shows the routed MVP shell on the home screen', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: /feedback system/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open intake scaffold/i }),
    ).toHaveAttribute('href', '/submit/demo-app')
    expect(
      screen.getByRole('link', { name: /open console scaffold/i }),
    ).toHaveAttribute('href', '/console')
  })

  it('renders the intake route scaffold', () => {
    render(
      <MemoryRouter initialEntries={['/submit/demo-app']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /hosted feedback intake/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/app key in route: demo-app/i)).toBeInTheDocument()
  })

  it('renders the console route scaffold', () => {
    render(
      <MemoryRouter initialEntries={['/console']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /developer console/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/single-owner review surface for the inbox/i),
    ).toBeInTheDocument()
  })
})

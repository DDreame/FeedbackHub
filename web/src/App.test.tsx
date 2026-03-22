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
      screen.getByRole('heading', { level: 1, name: /feedBack system/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /打开反馈入口/i }),
    ).toHaveAttribute('href', '/submit/demo-app')
    expect(
      screen.getByRole('link', { name: /查看历史/i }),
    ).toHaveAttribute('href', '/history')
    expect(
      screen.getByRole('link', { name: /打开开发者控制台/i }),
    ).toHaveAttribute('href', '/console')
  })

  it('renders the feedback submit page', () => {
    render(
      <MemoryRouter initialEntries={['/submit/demo-app']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /提交反馈/i,
      }),
    ).toBeInTheDocument()
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

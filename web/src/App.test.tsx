import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('shows the product landing page on the home screen', () => {
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
  })

  it('does not show developer console link on the homepage', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.queryByRole('link', { name: /打开开发者控制台/i }),
    ).not.toBeInTheDocument()
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

  it('renders the console placeholder page', () => {
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
      screen.getByText(/此功能正在开发中/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /返回首页/i }),
    ).toHaveAttribute('href', '/')
  })
})

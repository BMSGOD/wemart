import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RouterProvider, useRouter } from '../router'

function Probe() {
  const { path, navigate } = useRouter()
  return (
    <>
      <output data-testid="path">{path}</output>
      <button onClick={() => navigate('/auth/login')} data-testid="go">go</button>
    </>
  )
}

/** Micro router: path state + push + popstate round-trips. */
describe('RouterProvider', () => {
  it('starts on the current pathname and follows navigate()', () => {
    render(
      <RouterProvider>
        <Probe />
      </RouterProvider>,
    )
    expect(screen.getByTestId('path').textContent).toBe('/')
    fireEvent.click(screen.getByTestId('go'))
    expect(screen.getByTestId('path').textContent).toBe('/auth/login')
    expect(window.location.pathname).toBe('/auth/login')
    expect(window.history.length).toBeGreaterThan(1)
  })
})

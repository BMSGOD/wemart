import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AuthPrompt from '../AuthPrompt'
import { RouterProvider } from '../../lib/router'

function mount(open = true) {
  return render(
    <RouterProvider>
      <AuthPrompt
        open={open}
        vendorName="Ada Gadgets"
        onClose={vi.fn()}
        onContinueWithoutAccount={vi.fn()}
      />
    </RouterProvider>,
  )
}

/** Pre-WhatsApp-contact prompt: optional sign-in, honest skip. */
describe('AuthPrompt', () => {
  it('renders the three choices', () => {
    mount()
    expect(screen.getByText(/Contact Ada Gadgets/)).toBeTruthy()
    expect(screen.getByTestId('auth-prompt-sign-in')).toBeTruthy()
    expect(screen.getByTestId('auth-prompt-create')).toBeTruthy()
    expect(screen.getByTestId('auth-prompt-continue')).toBeTruthy()
  })

  it('continue-without-account proceeds without forcing sign-in', () => {
    const onContinue = vi.fn()
    render(
      <RouterProvider>
        <AuthPrompt
          open
          vendorName="Ada Gadgets"
          onClose={() => {}}
          onContinueWithoutAccount={onContinue}
        />
      </RouterProvider>,
    )
    fireEvent.click(screen.getByTestId('auth-prompt-continue'))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('Escape closes the dialog', () => {
    const onClose = vi.fn()
    render(
      <RouterProvider>
        <AuthPrompt open vendorName="V" onClose={onClose} onContinueWithoutAccount={() => {}} />
      </RouterProvider>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders nothing while closed', () => {
    const { container } = mount(false)
    expect(container.childElementCount).toBe(0)
  })
})

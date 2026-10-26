import { useEffect } from 'react'
import { useRouter } from '../lib/router'

/**
 * Pre-contact auth prompt — blocks a WhatsApp vendor-contact action behind
 * an OPTIONAL sign-in / create-account step with "Continue without account".
 *
 * WIRING STATUS: the catalog view exposes vendor_id/vendor_name but NO
 * phone/WhatsApp number (verified 2026-10-27), so no contact button exists
 * on ProductCard yet. When the catalog (or an RPC approved by the owner)
 * exposes vendor contact info, the card calls <AuthPrompt …> first and only
 * then opens buildVendorWhatsAppUrl(). Until then the modal ships tested
 * but unwired — no fake contact flows.
 */

type Props = {
  open: boolean
  vendorName: string
  onClose: () => void
  onContinueWithoutAccount: () => void
}

export default function AuthPrompt({
  open,
  vendorName,
  onClose,
  onContinueWithoutAccount,
}: Props) {
  const { path } = useRouter()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  void path // router context available for link labels below

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      onClick={onClose}
      data-testid="auth-prompt-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        data-testid="auth-prompt"
        className="w-full max-w-sm rounded-lg border border-border bg-white p-5 shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="auth-prompt-title"
          className="text-base font-bold text-ink sm:text-lg"
        >
          Contact {vendorName}
        </h2>
        <p className="mt-1 text-sm text-ink/70">
          Sign in first, or continue without an account — chatting with the
          vendor on WhatsApp works either way.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <a
            href="/auth/login"
            data-testid="auth-prompt-sign-in"
            className="rounded-full bg-orange px-4 py-2.5 text-center text-sm font-bold text-ink transition-colors duration-150 hover:bg-orange-deep hover:text-white"
          >
            Sign in
          </a>
          <a
            href="/auth/register"
            data-testid="auth-prompt-create"
            className="rounded-lg border border-border bg-white px-4 py-2.5 text-center text-sm font-bold text-ink transition hover:border-ink"
          >
            Create an account
          </a>
          <button
            type="button"
            data-testid="auth-prompt-continue"
            onClick={onContinueWithoutAccount}
            className="rounded-lg px-4 py-2 text-center text-sm font-medium text-ink/70 underline underline-offset-2 hover:text-orange-deep"
          >
            Continue without account
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * WhatsApp deep link for a vendor contact — returns null until the live
 * catalog/RPC actually exposes the vendor's WhatsApp number (0009/0008
 * review decides how). Never synthesize a number.
 */
export function buildVendorWhatsAppUrl(
  phone: string | null | undefined,
  productTitle: string,
): string | null {
  if (!phone || !phone.trim()) return null
  const digits = phone.replace(/[^\d]/g, '')
  const text = encodeURIComponent(`Hi, I'm interested in "${productTitle}" on Wemart.`)
  return `https://wa.me/${digits}?text=${text}`
}

/**
 * Friendly full-page notice shown when the Supabase env vars are missing
 * (no VITE_SUPABASE_URL / VITE_SUPABASE_KEY). Uses only existing brand
 * tokens — same design language as the storefront.
 */
export default function SetupNotice() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4">
      <section className="hard-shadow w-full max-w-sm rounded-lg border border-border bg-white p-6 text-center">
        <img
          src="/wemart-logo.png"
          alt="Wemart"
          width={512}
          height={512}
          className="mx-auto h-12 w-12 rounded-lg"
        />
        <h1 className="mt-3 text-lg font-bold text-ink">
          We're setting things up.
        </h1>
        <p className="mt-1 text-sm text-ink/70">
          Wemart is being set up. The marketplace catalog isn't connected yet —
          please check back again shortly.
        </p>
      </section>
      <p className="mt-4 text-center text-[11px] text-ink/40">
        No payments are processed. Meet sellers safely in public places.
      </p>
    </div>
  )
}

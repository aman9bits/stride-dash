'use client'

import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/posthog'

interface Props {
  email: string | null
  token: string | null
}

export default function LandingPage({ email, token }: Props) {
  const supabase = createClient()

  async function handleGoogleSignIn() {
    track('auth_started', { method: 'google' })
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback${token ? `?state=${token}` : ''}`,
        ...(email ? { queryParams: { login_hint: email } } : {}),
      },
    })
  }

  async function handleMagicLink() {
    if (!email) return
    track('auth_started', { method: 'magic_link' })
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback${token ? `?state=${token}` : ''}`,
      },
    })
    alert(`Check ${email} for your sign-in link.`)
  }

  return (
    <div className="min-h-screen flex flex-col max-w-[430px] mx-auto px-6" style={{ background: 'var(--bg)' }}>
      {/* Wordmark */}
      <div className="pt-10 pb-1">
        <div className="text-[10px] font-extrabold tracking-[0.22em] uppercase" style={{ color: 'var(--accent)' }}>
          Stride Dash
        </div>
      </div>

      {/* Value prop */}
      <div className="flex-1 flex flex-col justify-center pb-12">
        <div className="mb-12">
          <h1
            className="text-[32px] font-extrabold leading-tight mb-4"
            style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}
          >
            3 jobs,<br/>curated for you.
          </h1>
          <p className="text-[16px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Not 300. Not a search box. Jobs that fit your situation — and an honest explanation why.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-[15px] font-bold transition-opacity active:opacity-80"
            style={{ background: 'var(--accent)', color: '#060C1A' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#060C1A" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="rgba(6,12,26,0.5)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="rgba(6,12,26,0.35)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="rgba(6,12,26,0.65)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {email && (
            <button
              onClick={handleMagicLink}
              className="w-full text-center text-[13px] py-2.5 transition-colors active:opacity-70"
              style={{ color: 'var(--text-3)' }}
            >
              Use email instead ({email})
            </button>
          )}
        </div>

        <p className="mt-10 text-[11px] text-center" style={{ color: 'var(--text-3)' }}>
          Early access · No spam · Unsubscribe anytime
        </p>
      </div>
    </div>
  )
}

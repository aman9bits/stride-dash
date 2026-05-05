'use client'

import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/posthog'

interface Props {
  email: string
  token: string
}

export default function LandingPage({ email, token }: Props) {
  const supabase = createClient()

  async function handleGoogleSignIn() {
    track('auth_started', { method: 'google' })
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?state=${token}`,
        queryParams: { login_hint: email },
      },
    })
  }

  async function handleMagicLink() {
    track('auth_started', { method: 'magic_link' })
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?state=${token}`,
      },
    })
    alert(`Check ${email} for your sign-in link.`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Stride Dash</h1>
        </div>

        {/* Value prop */}
        <div className="mb-10">
          <p className="text-xl font-semibold text-gray-900 leading-snug mb-3">
            3 jobs, curated for you.
          </p>
          <p className="text-gray-500 text-base leading-relaxed">
            Not 300. Not a search box. Jobs that fit your situation — and an honest explanation why.
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white rounded-xl py-4 text-base font-medium active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#4CAF50" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#1976D2" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#E53935" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={handleMagicLink}
            className="w-full text-center text-sm text-gray-500 py-2 active:text-gray-700"
          >
            Use email instead ({email})
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">
          Private pilot for Shine Learning community.
        </p>
      </div>
    </div>
  )
}

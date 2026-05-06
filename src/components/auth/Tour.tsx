'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/posthog'

const SCREENS = [
  {
    eyebrow: 'THE REALITY',
    headline: 'You applied to 300.\nGot ignored on 297.',
    body: "That's not a rejection problem. It's noise. Most applications are never read — wrong role, wrong signal, wrong timing. The problem isn't your CV.",
  },
  {
    eyebrow: 'THE FIX',
    headline: '3 that fit beats\n300 that don\'t.',
    body: 'Not a search box. Not job alerts. A short list matched to your specific situation — with a written explanation of why each one fits you right now.',
  },
  {
    eyebrow: 'HONEST HEADS-UP',
    headline: 'First batch =\nrough cut.',
    body: 'Built on 6 questions. Gets sharper every time you react — apply, dismiss, tell us why. Most people see the real signal by batch 3.',
  },
]

export default function Tour() {
  const supabase = createClient()
  const [screen, setScreen] = useState(0)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [magicEmail, setMagicEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)

  const isLast = screen === SCREENS.length - 1
  const s = SCREENS[screen]

  async function handleGoogle() {
    track('auth_started', { method: 'google', from: 'tour' })
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })
  }

  async function handleMagicLink() {
    if (!magicEmail.trim()) return
    track('auth_started', { method: 'magic_link', from: 'tour' })
    await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })
    setMagicSent(true)
  }

  return (
    <div
      className="min-h-screen max-w-[430px] mx-auto flex flex-col px-6"
      style={{ background: 'var(--bg)' }}
    >
      {/* Wordmark */}
      <div className="pt-10 pb-1 flex-shrink-0">
        <div
          className="text-[10px] font-extrabold tracking-[0.22em] uppercase"
          style={{ color: 'var(--accent)' }}
        >
          Stride Dash
        </div>
      </div>

      {/* Screen content */}
      <div className="flex-1 flex flex-col justify-center pb-4">
        <div
          className="text-[10px] font-extrabold tracking-[0.18em] uppercase mb-5"
          style={{ color: 'var(--text-3)' }}
        >
          {s.eyebrow}
        </div>

        <h1
          className="text-[36px] font-extrabold leading-tight mb-5"
          style={{
            color: 'var(--text-1)',
            letterSpacing: '-0.03em',
            whiteSpace: 'pre-line',
          }}
        >
          {s.headline}
        </h1>

        <p className="text-[16px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {s.body}
        </p>
      </div>

      {/* Bottom */}
      <div className="pb-10 flex-shrink-0">
        {/* Progress dots */}
        <div className="flex gap-1.5 mb-6">
          {SCREENS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === screen ? 20 : 6,
                background: i === screen ? 'var(--accent)' : 'var(--border-b)',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        {!isLast ? (
          <button
            onClick={() => setScreen(s => s + 1)}
            className="w-full py-4 rounded-2xl text-[15px] font-bold transition-colors active:opacity-80"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          >
            Next →
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Google */}
            <button
              onClick={handleGoogle}
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

            {/* Email fallback */}
            {!showEmailInput && !magicSent && (
              <button
                onClick={() => setShowEmailInput(true)}
                className="w-full text-center text-[13px] py-2 transition-opacity active:opacity-60"
                style={{ color: 'var(--text-3)' }}
              >
                Sign in with email instead
              </button>
            )}

            {showEmailInput && !magicSent && (
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={magicEmail}
                  onChange={e => setMagicEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
                  className="flex-1 bg-transparent outline-none text-[14px] px-4 py-3 rounded-xl"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-1)' }}
                  autoFocus
                />
                <button
                  onClick={handleMagicLink}
                  className="px-4 py-3 rounded-xl text-[13px] font-semibold"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                  }}
                >
                  Send
                </button>
              </div>
            )}

            {magicSent && (
              <div className="text-center py-2">
                <div className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
                  ✓ Check {magicEmail} for your sign-in link
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                  Check spam if it doesn&apos;t arrive in 30 seconds
                </div>
              </div>
            )}

            {/* Legal */}
            <div
              className="text-center text-[11px] leading-relaxed mt-1"
              style={{ color: 'var(--text-3)' }}
            >
              By continuing you agree to our{' '}
              <a href="/terms" style={{ color: 'var(--text-2)' }}>Terms</a>
              {' '}and{' '}
              <a href="/privacy" style={{ color: 'var(--text-2)' }}>Privacy Policy</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const token = url.searchParams.get('state') // invite token passed via OAuth state

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
  }

  // Check if candidate profile already exists
  const { data: existing } = await supabaseAdmin
    .from('candidates')
    .select('candidate_id, onboarding_complete')
    .eq('auth_user_id', user.id)
    .single()

  if (!existing) {
    // New user — create candidate profile
    const cohortId = 'shine-learning-apr-2026'

    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .insert({
        auth_user_id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name ?? null,
        cohort_id: cohortId,
      })
      .select('candidate_id')
      .single()

    // Link invite token to candidate
    if (token && candidate) {
      await supabaseAdmin
        .from('invite_tokens')
        .update({
          candidate_id: candidate.candidate_id,
          signup_completed_at: new Date().toISOString(),
        })
        .eq('token', token)
    }

    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  // Returning user
  if (existing.onboarding_complete) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.redirect(new URL('/onboarding', request.url))
}

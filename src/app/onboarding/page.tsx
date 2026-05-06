import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server'
import OnboardingChat from '@/components/onboarding/OnboardingChat'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!candidate) redirect('/login')
  if (candidate.onboarding_complete) redirect('/home')

  return <OnboardingChat candidate={candidate} />
}

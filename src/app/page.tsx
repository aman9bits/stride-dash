import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check onboarding state
  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('onboarding_complete')
    .eq('auth_user_id', user.id)
    .single()

  if (!candidate || !candidate.onboarding_complete) {
    redirect('/onboarding')
  }

  redirect('/home')
}

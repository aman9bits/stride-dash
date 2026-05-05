import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server'
import RecommendationCard from '@/components/recommendations/RecommendationCard'
import GeneratingState from '@/components/recommendations/GeneratingState'
import type { Recommendation, Job } from '@/types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/invite/start')

  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!candidate) redirect('/invite/start')
  if (!candidate.onboarding_complete) redirect('/onboarding')

  const today = new Date().toISOString().split('T')[0]

  // Fetch today's batch (ranks 1–4: 3 shown + 1 runner-up)
  const { data: rawRecs } = await supabaseAdmin
    .from('recommendations')
    .select('*, job:jobs(*)')
    .eq('candidate_id', candidate.candidate_id)
    .eq('batch_date', today)
    .in('rank_in_batch', [1, 2, 3, 4])
    .order('rank_in_batch', { ascending: true })

  const recs = (rawRecs ?? []) as (Recommendation & { job: Job })[]
  const shownRecs = recs.filter(r => r.rank_in_batch <= 3)
  const runnerUp = recs.find(r => r.rank_in_batch === 4) ?? null

  // No recs yet — matching run is in progress (triggered from onboarding)
  if (shownRecs.length === 0) {
    return <GeneratingState candidateId={candidate.candidate_id} />
  }

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Stride Dash</span>
          <span className="text-xs text-gray-400">3 for you today</span>
        </div>
      </div>

      {/* Cards */}
      <div className="divide-y divide-gray-100 pb-12">
        {shownRecs.map(rec => (
          <RecommendationCard
            key={rec.rec_id}
            rec={rec}
            job={rec.job}
            runnerUp={runnerUp}
            candidateId={candidate.candidate_id}
          />
        ))}
      </div>
    </div>
  )
}

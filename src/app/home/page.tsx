import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server'
import RecommendationCard from '@/components/recommendations/RecommendationCard'
import GeneratingState from '@/components/recommendations/GeneratingState'
import type { Recommendation, Job } from '@/types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!candidate) redirect('/login')
  if (!candidate.onboarding_complete) redirect('/onboarding')

  const today = new Date().toISOString().split('T')[0]
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

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

  if (shownRecs.length === 0) {
    return <GeneratingState candidateId={candidate.candidate_id} candidate={candidate} />
  }

  return (
    <div className="min-h-screen max-w-[430px] mx-auto flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 flex-shrink-0">
        <div>
          <div className="text-[20px] font-extrabold tracking-tight" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Your matches
          </div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-3)' }}>
            {dateLabel} · {shownRecs.length} from {runnerUp ? shownRecs.length + 1 : shownRecs.length} shortlisted
          </div>
        </div>
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 8a5.5 5.5 0 11-1-3.2"/>
            <path d="M13.5 2.5v3h-3"/>
          </svg>
        </div>
      </div>

      {/* Cards feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3.5 pb-8 flex flex-col gap-2.5">
        {shownRecs.map(rec => (
          <RecommendationCard
            key={rec.rec_id}
            rec={rec}
            job={rec.job}
            runnerUp={runnerUp}
            candidateId={candidate.candidate_id}
          />
        ))}
        <div className="text-[11px] text-center pt-2 pb-1 leading-relaxed" style={{ color: 'var(--text-3)' }}>
          {shownRecs.length} of {shownRecs.length} matches · New picks tomorrow.
        </div>
      </div>
    </div>
  )
}

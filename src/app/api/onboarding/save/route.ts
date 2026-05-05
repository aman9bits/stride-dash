import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { CandidateProfile } from '@/types'

const PROFILE_FIELDS = [
  'current_role_title', 'total_experience_years', 'primary_skills',
  'location_preference', 'target_company_types', 'salary_floor_lpa',
  'trigger_state', 'what_is_broken', 'target_role_type',
  'remote_preference', 'career_aspiration', 'hard_constraints',
  'target_function_change', 'current_company_type',
]

function computeCompleteness(profile: Partial<CandidateProfile>): number {
  const filled = PROFILE_FIELDS.filter(f => {
    const val = profile[f as keyof CandidateProfile]
    if (Array.isArray(val)) return val.length > 0
    return val !== null && val !== undefined && val !== ''
  })
  return Math.round((filled.length / PROFILE_FIELDS.length) * 100) / 100
}

export async function POST(request: NextRequest) {
  const { candidate_id, fields, turn_number, onboarding_complete } = await request.json()

  const profile_completeness = computeCompleteness(fields)

  const { error } = await supabaseAdmin
    .from('candidates')
    .update({
      ...fields,
      onboarding_turn: turn_number,
      onboarding_complete: onboarding_complete ?? false,
      profile_completeness,
      updated_at: new Date().toISOString(),
    })
    .eq('candidate_id', candidate_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, profile_completeness })
}

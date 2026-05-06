// ─── Enums ────────────────────────────────────────────────────────────────────

export type TriggerState = 'fleeing' | 'laid_off' | 'passively_open'
export type CompanyType = 'service_co' | 'product' | 'startup' | 'mnc' | 'unknown'
export type TargetRoleType = 'ic' | 'manager' | 'both'
export type FunctionChange = 'same' | 'adjacent' | 'open'
export type RemotePreference = 'remote' | 'hybrid' | 'office' | 'flexible'
export type SalaryConfidence = 'hardcoded' | 'fallback' | 'unknown'
export type ReactionType = 'apply' | 'dismiss' | 'ask_why'

// ─── Candidate Profile ────────────────────────────────────────────────────────

export interface CandidateProfile {
  candidate_id: string
  auth_user_id: string
  email: string
  name: string | null

  // Current situation
  current_role_title: string | null
  current_company: string | null
  current_company_type: CompanyType | null
  total_experience_years: number | null
  primary_skills: string[]
  current_location: string | null

  // Search preferences
  target_company_types: CompanyType[]
  target_role_type: TargetRoleType | null
  target_function_change: FunctionChange | null
  location_preference: string[]
  remote_preference: RemotePreference | null
  salary_floor_lpa: number | null

  // Soft context
  trigger_state: TriggerState | null
  what_is_broken: string | null
  career_aspiration: string | null
  hard_constraints: string | null

  // Learned
  learned_preferences: string
  dismissed_job_ids: string[]
  applied_job_ids: string[]

  // Metadata
  profile_completeness: number
  onboarding_complete: boolean
  onboarding_turn: number
  cohort_id: string
  last_matching_run: string | null
  created_at: string
  updated_at: string
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface Job {
  job_id: string
  title: string
  jd_text: string | null
  skills_raw: string | null
  min_exp: number | null
  max_exp: number | null
  industry: string | null
  locations_raw: string | null
  published_date: string | null
  company_name: string | null
  company_type: CompanyType
  stage: string | null           // e.g. "Series A", "Series C", "Post-IPO"
  role_level: string | null      // e.g. "IC", "Lead", "Manager"
  job_url: string | null         // direct application URL
  locations: string[]
  is_pan_india: boolean
  job_age_days: number | null
  salary_min_lpa: number | null
  salary_max_lpa: number | null
  salary_confidence: SalaryConfidence
  ingested_at: string
  is_active: boolean
}

// ─── Recommendation ───────────────────────────────────────────────────────────

export interface Recommendation {
  rec_id: string
  candidate_id: string
  job_id: string
  why_it_fits: string[]
  uncertainty_flags: string[]
  filter_summary: string
  runner_up_reason: string | null
  rank_in_batch: number
  batch_date: string
  reaction_type: ReactionType | null
  reaction_at: string | null
  dismiss_reason: string | null
  apply_reason: string | null
  created_at: string
  // Joined from jobs table
  job?: Job
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export interface OnboardingTurn {
  turn_number: number
  system_question: string
  candidate_response: string | null
  clarification_sent: string | null
  clarification_response: string | null
  extracted_fields: Record<string, unknown>
  extraction_confidence: Record<string, number>
  needs_clarification: boolean
}

export interface ParseTurnRequest {
  candidate_id: string
  session_id: string
  turn_number: number
  system_question: string
  candidate_response: string
  clarification_sent?: string
  clarification_response?: string
  prior_context: Partial<CandidateProfile>
}

export interface ParseTurnResponse {
  extracted: Partial<CandidateProfile>
  confidence: Record<string, number>
  needs_clarification: boolean
  clarification_prompt: string | null
  verbatim_capture: string
}

// ─── Invite ───────────────────────────────────────────────────────────────────

export interface InviteToken {
  token: string
  email: string
  cohort_id: string
  candidate_id: string | null
  invite_sent_at: string
  invite_clicked_at: string | null
  signup_completed_at: string | null
  is_expired: boolean
  expires_at: string
}

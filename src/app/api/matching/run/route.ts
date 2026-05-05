import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { anthropic, MODELS } from '@/lib/anthropic'
import type { CandidateProfile, Job } from '@/types'

// ─── Salary bands (hardcoded, no salary data in Google Jobs feed) ─────────────

const SALARY_BANDS: Record<string, Record<string, [number, number]>> = {
  Bangalore:  { '3-5': [18, 35], '6-8': [30, 55], '9+': [45, 80] },
  Hyderabad:  { '3-5': [15, 28], '6-8': [25, 45], '9+': [35, 65] },
  Pune:       { '3-5': [15, 28], '6-8': [25, 45], '9+': [35, 65] },
  Mumbai:     { '3-5': [15, 25], '6-8': [25, 40], '9+': [35, 60] },
  Chennai:    { '3-5': [12, 22], '6-8': [20, 35], '9+': [28, 50] },
  default:    { '3-5': [12, 22], '6-8': [20, 35], '9+': [28, 50] },
}

function getSalaryBand(city: string, years: number): [number, number] {
  const cityBands = SALARY_BANDS[city] ?? SALARY_BANDS.default
  if (years <= 5) return cityBands['3-5']
  if (years <= 8) return cityBands['6-8']
  return cityBands['9+']
}

// ─── Pre-filter ───────────────────────────────────────────────────────────────

async function preFilterJobs(candidate: CandidateProfile): Promise<Job[]> {
  const exp = candidate.total_experience_years ?? 5
  const locations = candidate.location_preference ?? []
  const companyTypes = candidate.target_company_types ?? []

  let query = supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .lte('min_exp', exp + 1)
    .gte('max_exp', exp - 1)
    .not('job_id', 'in', `(${[...candidate.dismissed_job_ids, ...candidate.applied_job_ids].join(',') || 'null'})`)

  // Company type filter
  if (companyTypes.length > 0) {
    query = query.or(`company_type.in.(${companyTypes.join(',')}),company_type.eq.unknown`)
  }

  // Location filter — include pan-India jobs always
  if (locations.length > 0) {
    const locationFilters = locations.map(l => `locations.cs.{${l}}`).join(',')
    query = query.or(`is_pan_india.eq.true,${locationFilters}`)
  }

  // Soft derank old jobs — fetch all but order fresher first
  query = query.order('published_date', { ascending: false }).limit(300)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Job[]
}

// ─── Step 1: Rough ranking ────────────────────────────────────────────────────

async function roughRank(candidate: CandidateProfile, jobs: Job[]): Promise<string[]> {
  const jobList = jobs
    .map(j => `${j.job_id} | ${j.title} | ${j.company_type} | ${(j.skills_raw ?? '').slice(0, 150)}`)
    .join('\n')

  const prompt = `You are ranking job recommendations for a candidate on Stride Dash.

CANDIDATE PROFILE:
- Current role: ${candidate.current_role_title}, ${candidate.total_experience_years} years
- Top skills: ${candidate.primary_skills?.join(', ')}
- Why they're looking: ${candidate.what_is_broken}
- Target: ${candidate.target_company_types?.join(', ')} companies, ${candidate.target_role_type} role, ${candidate.location_preference?.join(', ')}
- Learned preferences: ${candidate.learned_preferences || 'None yet'}

JOB LIST (format: ID | Title | Company type | Required skills):
${jobList}

Rank the top 8 jobs by how well they match this candidate's SPECIFIC SITUATION — not generic skill overlap. Prioritise jobs where you can make a specific, genuine connection between what they said is broken and what the role offers.

Return ONLY valid JSON: {"ranked": ["job_id_1", ..., "job_id_8"]}`

  const message = await anthropic.messages.create({
    model: MODELS.haiku,
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch?.[0] ?? '{"ranked":[]}')
  return parsed.ranked ?? []
}

// ─── Step 2: Full explanation ─────────────────────────────────────────────────

interface ExplanationResult {
  job_id: string
  why_it_fits: string[]
  uncertainty_flags: string[]
  filter_summary: string
  runner_up_reason: string | null
  low_fit: boolean
}

async function generateExplanation(
  candidate: CandidateProfile,
  job: Job,
  poolSize: number,
  filteredSize: number,
  isRunnerUp: boolean
): Promise<ExplanationResult> {
  const city = candidate.location_preference?.[0] ?? 'Bangalore'
  const years = candidate.total_experience_years ?? 5
  const [salaryMin, salaryMax] = getSalaryBand(city, years)

  // Apply salary band to job if not already set
  const jobWithSalary = {
    ...job,
    salary_min_lpa: job.salary_min_lpa ?? salaryMin,
    salary_max_lpa: job.salary_max_lpa ?? salaryMax,
    salary_confidence: job.salary_confidence ?? 'hardcoded',
  }

  const prompt = `You are generating a job recommendation explanation for Stride Dash.

CANDIDATE PROFILE:
- Current role: ${candidate.current_role_title}, ${candidate.total_experience_years} years
- Top skills: ${candidate.primary_skills?.join(', ')}
- Why they're looking (their words): "${candidate.what_is_broken}"
- Career aspiration: "${candidate.career_aspiration ?? 'Not captured yet'}"
- Target: ${candidate.target_company_types?.join(', ')} companies, ${candidate.target_role_type} role, ${candidate.location_preference?.join(', ')}
- Salary floor: ₹${candidate.salary_floor_lpa}L
- Learned preferences: ${candidate.learned_preferences || 'None yet'}

JOB:
- ID: ${job.job_id}
- Title: ${job.title}
- Company: ${job.company_name ?? 'Not disclosed'} (${job.company_type})
- Location: ${job.locations?.join(', ')}
- Posted: ${job.job_age_days} days ago
- Salary: ₹${jobWithSalary.salary_min_lpa}–${jobWithSalary.salary_max_lpa}L (${jobWithSalary.salary_confidence})
- Required skills: ${job.skills_raw ?? 'Not specified'}
- Job description: ${(job.jd_text ?? '').slice(0, 1500)}

INSTRUCTIONS:
Generate a JSON object:

"why_it_fits": Array of 2–3 strings. Each MUST:
  - Reference something specific from the candidate profile AND something specific from the JD
  - Use their own words from what_is_broken where possible
  - Format: "You said [their situation] — this role [specific JD element]"
  - Never be generic. "Matches your PM background" = rejected.

"low_fit": Boolean. Set true if you cannot write 2 genuine, specific why_it_fits bullets.

"uncertainty_flags": Array of 1–2 strings of genuine uncertainties.
  Always include salary uncertainty if salary_confidence is "hardcoded".

"filter_summary": "From ${poolSize} jobs this week, we filtered to ${filteredSize} matching roles. This ranked in the top 3."

"runner_up_reason": ${isRunnerUp ? '"We considered this — ranked lower because [specific reason connected to candidate profile]."' : 'null'}

Return ONLY valid JSON.`

  const message = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    const result = JSON.parse(jsonMatch?.[0] ?? '{}')
    return {
      job_id: job.job_id,
      why_it_fits: result.why_it_fits ?? [],
      uncertainty_flags: result.uncertainty_flags ?? [],
      filter_summary: result.filter_summary ?? '',
      runner_up_reason: result.runner_up_reason ?? null,
      low_fit: result.low_fit ?? false,
    }
  } catch {
    return {
      job_id: job.job_id,
      why_it_fits: [],
      uncertainty_flags: ['We had trouble generating an explanation for this match.'],
      filter_summary: '',
      runner_up_reason: null,
      low_fit: true,
    }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { candidate_id } = await request.json()
  const startTime = Date.now()

  // Fetch candidate
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from('candidates')
    .select('*')
    .eq('candidate_id', candidate_id)
    .single()

  if (candidateError || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Check if batch already exists for today
  const { data: existing } = await supabaseAdmin
    .from('recommendations')
    .select('rec_id')
    .eq('candidate_id', candidate_id)
    .eq('batch_date', today)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ already_exists: true })
  }

  // Update job_age_days before filtering
  await supabaseAdmin.rpc('update_job_ages') // optional — see note below

  // Stage 1: Pre-filter
  const filteredJobs = await preFilterJobs(candidate as CandidateProfile)
  const poolSizePrefilter = filteredJobs.length

  if (filteredJobs.length === 0) {
    return NextResponse.json({ no_matches: true, message: 'No jobs match your filters this week.' })
  }

  // Stage 2a: Rough ranking
  const rankedIds = await roughRank(candidate as CandidateProfile, filteredJobs.slice(0, 200))

  // Get top 5 jobs in ranked order
  const top5Jobs = rankedIds
    .map(id => filteredJobs.find(j => j.job_id === id))
    .filter(Boolean)
    .slice(0, 5) as Job[]

  // Stage 2b: Full explanations
  let step2InputTokens = 0
  let step2OutputTokens = 0
  const explanations: ExplanationResult[] = []
  const fallbackPool = [...top5Jobs]

  for (let i = 0; i < Math.min(5, top5Jobs.length); i++) {
    const job = top5Jobs[i]
    const isRunnerUp = i === 3 // index 3 = rank 4 = runner-up
    const exp = await generateExplanation(
      candidate as CandidateProfile,
      job,
      poolSizePrefilter,
      filteredJobs.length,
      isRunnerUp
    )
    explanations.push(exp)
  }

  // Filter out low_fit, keep top 3 shown + 1 runner-up
  const validExplanations = explanations.filter(e => !e.low_fit)
  const shown = validExplanations.slice(0, 3)
  const runnerUp = validExplanations[3] ?? null
  const lowFitCount = explanations.filter(e => e.low_fit).length

  // Diversity check: ensure not all same company_type
  const shownJobs = shown.map(e => filteredJobs.find(j => j.job_id === e.job_id)!)
  const uniqueTypes = new Set(shownJobs.map(j => j.company_type))
  if (uniqueTypes.size === 1 && shown.length === 3) {
    // All same type — try to swap #3 with a different type from remaining pool
    const differentTypeExp = validExplanations.find((e, i) => {
      if (i < 3) return false
      const job = filteredJobs.find(j => j.job_id === e.job_id)
      return job && job.company_type !== shownJobs[0].company_type
    })
    if (differentTypeExp) {
      shown[2] = differentTypeExp
    }
  }

  // Store recommendations
  const recsToInsert = [
    ...shown.map((e, i) => ({
      candidate_id,
      job_id: e.job_id,
      why_it_fits: e.why_it_fits,
      uncertainty_flags: e.uncertainty_flags,
      filter_summary: e.filter_summary,
      runner_up_reason: null,
      rank_in_batch: i + 1,
      batch_date: today,
    })),
    ...(runnerUp ? [{
      candidate_id,
      job_id: runnerUp.job_id,
      why_it_fits: runnerUp.why_it_fits,
      uncertainty_flags: runnerUp.uncertainty_flags,
      filter_summary: runnerUp.filter_summary,
      runner_up_reason: runnerUp.runner_up_reason,
      rank_in_batch: 4,
      batch_date: today,
    }] : []),
  ]

  await supabaseAdmin.from('recommendations').insert(recsToInsert)

  // Update last_matching_run
  await supabaseAdmin
    .from('candidates')
    .update({ last_matching_run: new Date().toISOString() })
    .eq('candidate_id', candidate_id)

  // Log matching run
  await supabaseAdmin.from('matching_runs').insert({
    candidate_id,
    pool_size_prefilter: poolSizePrefilter,
    pool_size_postfilter: filteredJobs.length,
    job_ids_selected: shown.map(e => e.job_id),
    low_fit_count: lowFitCount,
    step2_input_tokens: step2InputTokens,
    step2_output_tokens: step2OutputTokens,
    duration_ms: Date.now() - startTime,
  })

  return NextResponse.json({
    success: true,
    recommendations_count: shown.length,
    pool_size: filteredJobs.length,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { anthropic, MODELS } from '@/lib/anthropic'
import type { ReactionType } from '@/types'

interface ReactionBody {
  candidate_id: string
  rec_id: string
  job_id: string
  reaction_type: ReactionType
  dismiss_reason?: string
  apply_reason?: string
  // Job context for inference
  company_name?: string
  company_type?: string
  job_title?: string
}

async function inferLearnedPreference(
  reaction_type: ReactionType,
  body: ReactionBody,
  candidate_role: string
): Promise<string> {
  const dateStr = new Date().toISOString().split('T')[0]

  if (reaction_type === 'dismiss') {
    const reason = body.dismiss_reason ?? 'No reason given'
    const prompt = `Candidate dismissed "${body.job_title}" at ${body.company_name} (${body.company_type}).
Reason given: ${reason}
Candidate's current role: ${candidate_role}

In one sentence starting with "Infer:", what preference does this dismissal signal? Be factual and specific.`

    const msg = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })
    const inference = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return `[${dateStr}] DISMISS: ${body.company_name} (${body.company_type}, ${body.job_title}). Reason: ${reason}. ${inference}`
  }

  if (reaction_type === 'apply') {
    let inference = ''
    if (!body.apply_reason) {
      const prompt = `Candidate applied to "${body.job_title}" at ${body.company_name} (${body.company_type}).
No explicit reason given. Candidate's current role: ${candidate_role}.
In one sentence starting with "Infer:", what does this application signal about their preference?`

      const msg = await anthropic.messages.create({
        model: MODELS.haiku,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })
      inference = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    }

    const resonated = body.apply_reason ? `Resonated with: "${body.apply_reason}". ` : ''
    return `[${dateStr}] APPLY: ${body.company_name} (${body.company_type}, ${body.job_title}). ${resonated}${inference}`
  }

  return ''
}

export async function POST(request: NextRequest) {
  const body: ReactionBody = await request.json()
  const { candidate_id, rec_id, job_id, reaction_type } = body

  // Update recommendation record
  await supabaseAdmin
    .from('recommendations')
    .update({
      reaction_type,
      reaction_at: new Date().toISOString(),
      dismiss_reason: body.dismiss_reason ?? null,
      apply_reason: body.apply_reason ?? null,
    })
    .eq('rec_id', rec_id)

  // Update candidate lists
  if (reaction_type === 'dismiss') {
    await supabaseAdmin.rpc('append_dismissed_job', { p_candidate_id: candidate_id, p_job_id: job_id })
  }
  if (reaction_type === 'apply') {
    await supabaseAdmin.rpc('append_applied_job', { p_candidate_id: candidate_id, p_job_id: job_id })
  }

  // Generate and append learned preference (dismiss + apply only)
  if (reaction_type !== 'ask_why') {
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('current_role_title, learned_preferences')
      .eq('candidate_id', candidate_id)
      .single()

    if (candidate) {
      const entry = await inferLearnedPreference(reaction_type, body, candidate.current_role_title ?? '')
      if (entry) {
        await supabaseAdmin
          .from('candidates')
          .update({
            learned_preferences: (candidate.learned_preferences ?? '') + '\n' + entry,
            updated_at: new Date().toISOString(),
          })
          .eq('candidate_id', candidate_id)
      }
    }
  }

  return NextResponse.json({ success: true })
}

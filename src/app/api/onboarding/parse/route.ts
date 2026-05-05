import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODELS } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { ParseTurnRequest, ParseTurnResponse } from '@/types'

// Fields that require clarification if confidence < 0.5
const BLOCKING_FIELDS: Record<number, string[]> = {
  1: ['what_is_broken'],
  2: ['current_role_title'],
  3: ['total_experience_years'],
  4: [],
  5: ['target_role_type'],
  6: [],
  7: [],
}

const TURN_FIELDS: Record<number, string[]> = {
  1: ['trigger_state', 'what_is_broken'],
  2: ['current_role_title', 'primary_skills', 'current_company'],
  3: ['total_experience_years', 'current_location'],
  4: ['location_preference', 'remote_preference'],
  5: ['target_company_types', 'target_role_type'],
  6: ['salary_floor_lpa'],
  7: ['corrections'],
}

const TURN_FIELD_SPECS: Record<number, string> = {
  1: `
- trigger_state (enum, blocking*): Infer from tone. "fleeing" = anger/betrayal/toxic environment. "laid_off" = layoff/restructuring. "passively_open" = curiosity/timing/passive.
- what_is_broken (text, blocking*): Capture near-verbatim. Their exact words matter. Light cleanup only — remove filler words. Do NOT summarise or shorten.`,

  2: `
- current_role_title (text, blocking*): Extract job title. Normalise abbreviations (Sr. PM → Senior Product Manager). If multiple roles mentioned, take current.
- primary_skills (array of strings): Ordered list, max 5. Preserve the order given — first = strongest skill.
- current_company (text, optional): Extract if mentioned. If not mentioned, return null.`,

  3: `
- total_experience_years (float, blocking*): Parse to float. "About 7 years" → 7.0. "7–8 years" → 7.0 (lower bound). "Since 2018" → compute from 2026. "10+" → 10.0.
- current_location (text): Extract city. Normalise: Bengaluru/BLR → Bangalore. Return standard city name.`,

  4: `
- location_preference (array of strings): List of cities they want to work in. If "open to anywhere" → return []. If unstated → return [current_location from prior context].
- remote_preference (enum): "remote"/"work from home" → "remote". "hybrid"/"2-3 days" → "hybrid". "office"/"in-person"/"WFO" → "office". Not mentioned/flexible → "flexible".`,

  5: `
- target_company_types (array of enums): Valid values: "service_co", "product", "startup", "mnc". Map naturally: "product company" → ["product"]. "startup" → ["startup"]. "large tech/FAANG/MNC" → ["mnc"]. "open/any" → ["product","startup"].
- target_role_type (enum, blocking*): "manage a team/want reports/people management" → "manager". "IC/individual contributor/no reports" → "ic". "mix/both/open" → "both". MUST ask for clarification if unclear.`,

  6: `
- salary_floor_lpa (float): Parse to LPA. "50 lakhs"/"50L"/"₹50L" → 50.0. "50-60" → 50.0 (floor). "around 50" → 50.0. "depends"/"negotiable"/unclear → null.`,

  7: `This is the confirmation turn. The candidate is reviewing a summary of their profile.
- If they say "looks good" or similar → no extractions needed, return empty extracted.
- If they correct something → extract what field was corrected and its new value.
- corrections (object): Map of field_name → corrected_value for any fields the candidate corrected.`,
}

export async function POST(request: NextRequest) {
  const body: ParseTurnRequest = await request.json()
  const {
    candidate_id,
    session_id,
    turn_number,
    system_question,
    candidate_response,
    clarification_sent,
    clarification_response,
    prior_context,
  } = body

  const isSecondAttempt = !!clarification_sent && !!clarification_response
  const model = turn_number === 1 ? MODELS.sonnet : MODELS.haiku
  const startTime = Date.now()

  const prompt = `You are parsing a candidate's response during job search onboarding for Stride Dash.

CONTEXT FROM PREVIOUS TURNS:
${JSON.stringify(prior_context, null, 2)}

CURRENT TURN: ${turn_number} of 7
QUESTION ASKED: "${system_question}"
CANDIDATE RESPONSE: "${candidate_response}"
${isSecondAttempt ? `CLARIFICATION ASKED: "${clarification_sent}"\nCLARIFICATION RESPONSE: "${clarification_response}"` : ''}

FIELDS TO EXTRACT THIS TURN:
${TURN_FIELD_SPECS[turn_number]}

INSTRUCTIONS:
1. Extract each field from the candidate's response.
2. For each field, assign a confidence score (0.0–1.0):
   - 1.0 = explicitly stated, unambiguous
   - 0.7–0.9 = clearly implied, minor inference
   - 0.4–0.6 = vague, significant inference required
   - < 0.4 = could not extract reliably
3. Blocking fields (marked with *): if confidence < 0.5 AND this is the FIRST attempt (not a second attempt), set needs_clarification = true and write a clarification_prompt (one sentence, ask only about the missing blocking field).
4. If this is a SECOND ATTEMPT (clarification was already sent): set needs_clarification = false regardless. Accept what you have.
5. For what_is_broken: capture near-verbatim. Do NOT summarise.

Return ONLY valid JSON:
{
  "extracted": { <field_name>: <value or null> },
  "confidence": { <field_name>: <0.0–1.0> },
  "needs_clarification": <true or false>,
  "clarification_prompt": "<one sentence or null>",
  "verbatim_capture": "<the candidate's raw response, unchanged>"
}`

  const message = await anthropic.messages.create({
    model,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const latencyMs = Date.now() - startTime
  const rawContent = message.content[0].type === 'text' ? message.content[0].text : ''

  let parsed: ParseTurnResponse
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? '{}')
  } catch {
    parsed = {
      extracted: {},
      confidence: {},
      needs_clarification: false,
      clarification_prompt: null,
      verbatim_capture: candidate_response,
    }
  }

  // Override needs_clarification on second attempt
  if (isSecondAttempt) {
    parsed.needs_clarification = false
    parsed.clarification_prompt = null
  }

  // Compute quality signals
  const confidenceValues = Object.values(parsed.confidence ?? {}) as number[]
  const minConfidence = confidenceValues.length > 0 ? Math.min(...confidenceValues) : 1
  const blockingFields = BLOCKING_FIELDS[turn_number] ?? []
  const blockingFieldLowConf = blockingFields.some(
    f => (parsed.confidence?.[f] ?? 1) < 0.6
  )

  // Log the turn
  await supabaseAdmin.from('onboarding_turns').insert({
    candidate_id,
    session_id,
    turn_number,
    system_question,
    candidate_response,
    clarification_sent: clarification_sent ?? null,
    clarification_response: clarification_response ?? null,
    extracted_fields: parsed.extracted ?? {},
    extraction_confidence: parsed.confidence ?? {},
    needs_clarification: parsed.needs_clarification,
    response_length_chars: candidate_response.length,
    min_confidence: minConfidence,
    blocking_field_low_conf: blockingFieldLowConf,
    clarification_was_needed: parsed.needs_clarification,
    clarification_resolved: isSecondAttempt ? minConfidence >= 0.6 : null,
    parsing_model: model,
    parsing_latency_ms: latencyMs,
    parsing_input_tokens: message.usage.input_tokens,
    parsing_output_tokens: message.usage.output_tokens,
  })

  return NextResponse.json(parsed)
}

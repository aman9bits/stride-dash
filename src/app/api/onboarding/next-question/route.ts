import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODELS } from '@/lib/anthropic'

// Intent and tone guidance per turn
const TURN_INTENTS: Record<number, { intent: string; note: string }> = {
  2: {
    intent: "Their current role title, company (if not already shared), and top 3–4 skills they're genuinely strongest at",
    note: 'React to what they shared about their situation. Ask about role and skills in one natural question — connect the ask to what they just described.',
  },
  3: {
    intent: 'How many years they have worked in this field, and which city they are currently based in',
    note: 'Keep it short. Two quick facts needed. Frame it as context you still need.',
  },
  4: {
    intent: "Where they want to work — same city as now, open to relocating, or remote/hybrid on the table",
    note: 'Reference their city from what they have shared. Make it a natural follow-up, not a form field.',
  },
  5: {
    intent: 'What type of company they are targeting (startup, funded scaleup, large tech/MNC, or open) and whether they want to manage a team or stay IC',
    note: 'Connect this to the frustration they described — autonomy issues often map to startup preference, scale issues to smaller companies.',
  },
  6: {
    intent: "The minimum salary floor — the lowest CTC they'd actually say yes to. Not their target, not their current CTC. Just the floor.",
    note: 'Keep the pressure off. Frame it as the last practical piece needed. Short acknowledgement, direct ask.',
  },
}

function buildContext(ctx: Record<string, unknown>): string {
  const lines: string[] = []
  if (ctx.current_role_title) {
    lines.push(`Role: ${ctx.current_role_title}${ctx.current_company ? ` at ${ctx.current_company}` : ''}`)
  }
  if (ctx.what_is_broken) {
    lines.push(`What's driving the search: "${ctx.what_is_broken}"`)
  }
  if (ctx.trigger_state) {
    lines.push(`Trigger type: ${ctx.trigger_state}`)
  }
  if (ctx.total_experience_years) {
    lines.push(`Experience: ${ctx.total_experience_years} years`)
  }
  if (ctx.current_location) {
    lines.push(`Based in: ${ctx.current_location}`)
  }
  if (Array.isArray(ctx.primary_skills) && ctx.primary_skills.length) {
    lines.push(`Skills: ${ctx.primary_skills.join(', ')}`)
  }
  return lines.length > 0 ? lines.join('\n') : 'Very early — only the answer above is available'
}

export async function POST(request: NextRequest) {
  const { completed_turn, last_answer, prior_context } = await request.json()

  const next_turn = completed_turn + 1
  const intentDef = TURN_INTENTS[next_turn]

  if (!intentDef) {
    return NextResponse.json({ question: null })
  }

  const context = buildContext(prior_context ?? {})

  const prompt = `You are the onboarding voice for Stride Dash — a job discovery product for mid-level IT professionals in India (developers, PMs, analysts, 4–10 years experience).

Tone: direct, warm, zero corporate-speak. Like a sharp friend who has helped a lot of people make job moves. Never open with "Great!", "Awesome!", "Thanks!", or any generic praise.

---
WHAT YOU KNOW ABOUT THIS PERSON:
${context}

WHAT THEY JUST SAID (Turn ${completed_turn}):
"${last_answer}"

WHAT YOU NEED TO LEARN NEXT (Turn ${next_turn}):
${intentDef.intent}

Tone guidance: ${intentDef.note}
---

Write the next question. Rules:
1. ONE sentence acknowledging something specific from their last answer — a real reaction, not generic. Reference their actual words or situation.
2. Then ask what you need to know for Turn ${next_turn} — naturally, 1–2 sentences max.
3. Total: 2–3 sentences. No bullet points, no headers, no markdown.
4. Output only the question text. Nothing else.`

  try {
    const message = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const question =
      message.content[0].type === 'text' ? message.content[0].text.trim() : null

    return NextResponse.json({ question })
  } catch (err) {
    console.error('[next-question] error:', err)
    return NextResponse.json({ question: null })
  }
}

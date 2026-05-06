'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/posthog'
import type { CandidateProfile } from '@/types'

// ─── Turn definitions ─────────────────────────────────────────────────────────

const TURNS = [
  {
    number: 1,
    question: "Before anything else — what's the situation that's got you looking right now?",
    hint: "Just talk to me. No forms, no dropdowns.",
    placeholder: "My manager blocks everything I try to ship…",
    inputType: 'textarea' as const,
  },
  {
    number: 2,
    question: "Got it. What's your current role, and what would you say you're genuinely strongest at — your top 3 or 4 skills?",
    hint: null,
    placeholder: "e.g. Senior PM at Flipkart, strongest at product strategy, data analysis, and stakeholder management",
    inputType: 'textarea' as const,
  },
  {
    number: 3,
    question: "Two quick ones — how many years have you been working in this field? And where are you based right now?",
    hint: null,
    placeholder: "e.g. 7 years, based in Bangalore",
    inputType: 'text' as const,
  },
  {
    number: 4,
    question: (city: string) =>
      `Where are you looking to work? Staying in ${city || 'your city'}, open to relocating, or is remote or hybrid on the table?`,
    hint: null,
    placeholder: "e.g. Bangalore only, open to hybrid",
    inputType: 'text' as const,
  },
  {
    number: 5,
    question: "What kind of company are you targeting? And manage a team or fly solo?",
    hint: null,
    placeholder: "Or add anything the chips don't cover…",
    inputType: 'chips' as const,
  },
  {
    number: 6,
    question: "Last one — what's the minimum you'd consider? Not your current CTC, just the floor you'd need to say yes.",
    hint: null,
    placeholder: "e.g. 70 LPA",
    inputType: 'text' as const,
  },
]

const COMPANY_CHIPS = [
  { label: 'Product startup', value: 'startup' },
  { label: 'Funded scaleup', value: 'product' },
  { label: 'Large tech / MNC', value: 'mnc' },
  { label: 'Open to all', value: 'any' },
]

const ROLE_CHIPS = [
  { label: 'IC — fly solo', value: 'ic' },
  { label: 'Manager — lead a team', value: 'manager' },
  { label: 'Mix of both', value: 'both' },
]

const CO_TYPE_LABELS: Record<string, string> = {
  startup: 'Startups', product: 'Funded scaleups', mnc: 'Large tech / MNC',
  service_co: 'Services', any: 'Open to all', unknown: '',
}
const ROLE_TYPE_LABELS: Record<string, string> = {
  ic: 'IC — fly solo', manager: 'Manager role', both: 'IC or Manager',
}

interface HistoryItem { question: string; answer: string }
interface Props { candidate: CandidateProfile }

// ─── Profile summary row builder ──────────────────────────────────────────────

function buildProfileRows(fields: Partial<CandidateProfile>): Array<{ label: string; value: string; isQuote?: boolean }> {
  const rows: Array<{ label: string; value: string; isQuote?: boolean }> = []

  const youParts = [
    fields.current_role_title ?? null,
    fields.current_company ? `at ${fields.current_company}` : null,
    fields.total_experience_years ? `${fields.total_experience_years} yrs` : null,
    fields.current_location ?? null,
  ].filter(Boolean)
  if (youParts.length > 0) rows.push({ label: 'You', value: youParts.join(' · ') })

  if (fields.what_is_broken) {
    rows.push({ label: "What's driving the search", value: fields.what_is_broken, isQuote: true })
  }

  const targetParts = [
    fields.target_company_types?.map(t => CO_TYPE_LABELS[t]).filter(Boolean).join(', ') ?? null,
    fields.target_role_type ? ROLE_TYPE_LABELS[fields.target_role_type] : null,
    fields.location_preference?.join(' / ') || fields.current_location || null,
  ].filter(Boolean)
  if (targetParts.length > 0) rows.push({ label: 'Targeting', value: targetParts.join(' · ') })

  if (fields.primary_skills?.length) {
    rows.push({ label: 'Top skills', value: fields.primary_skills.join(', ') })
  }

  if (fields.salary_floor_lpa) {
    rows.push({ label: 'Salary floor', value: `₹${fields.salary_floor_lpa}L+` })
  }

  return rows
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingChat({ candidate }: Props) {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentTurn, setCurrentTurn] = useState(1)
  const [inputValue, setInputValue] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isStartingMatch, setIsStartingMatch] = useState(false)
  const [profileFields, setProfileFields] = useState<Partial<CandidateProfile>>({})
  const [awaitingClarification, setAwaitingClarification] = useState<{
    clarificationPrompt: string
    originalResponse: string
    turnNumber: number
    systemQuestion: string
  } | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  // LLM-generated next question — null falls back to static TURNS question
  const [dynamicQuestion, setDynamicQuestion] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Stable ref for final fields at Turn 7 — avoids stale closure in button handler
  const finalFieldsRef = useRef<Partial<CandidateProfile>>({})

  useEffect(() => { track('onboarding_started') }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [history, awaitingClarification])

  function getCurrentQuestion(): string {
    // Prefer LLM-generated question if available
    if (dynamicQuestion) return dynamicQuestion
    const turn = TURNS[currentTurn - 1]
    if (typeof turn.question === 'function') {
      return turn.question(profileFields.current_location ?? '')
    }
    return turn.question
  }

  function buildChipResponse(): string {
    const parts: string[] = []
    if (selectedCompany.length > 0) {
      const labels = selectedCompany.map(v => COMPANY_CHIPS.find(c => c.value === v)?.label ?? v)
      parts.push(labels.join(', '))
    }
    if (selectedRole) {
      const label = ROLE_CHIPS.find(c => c.value === selectedRole)?.label ?? selectedRole
      parts.push(label)
    }
    if (inputValue.trim()) parts.push(inputValue.trim())
    return parts.join(' · ')
  }

  function canSubmit(): boolean {
    if (isProcessing) return false
    if (awaitingClarification) return inputValue.trim().length > 0
    if (currentTurn === 5) return selectedCompany.length > 0 || selectedRole !== '' || inputValue.trim().length > 0
    return inputValue.trim().length > 0
  }

  async function submitResponse() {
    if (!canSubmit()) return
    setIsProcessing(true)

    const response = awaitingClarification
      ? inputValue.trim()
      : currentTurn === 5
        ? buildChipResponse()
        : inputValue.trim()

    const systemQuestion = awaitingClarification
      ? awaitingClarification.systemQuestion
      : getCurrentQuestion()

    if (!awaitingClarification) {
      setHistory(prev => [...prev, { question: systemQuestion, answer: response }])
    }

    setInputValue('')
    setSelectedCompany([])
    setSelectedRole('')

    const parsePayload = {
      candidate_id: candidate.candidate_id,
      session_id: sessionId,
      turn_number: currentTurn,
      system_question: systemQuestion,
      candidate_response: awaitingClarification ? awaitingClarification.originalResponse : response,
      clarification_sent: awaitingClarification ? awaitingClarification.clarificationPrompt : undefined,
      clarification_response: awaitingClarification ? response : undefined,
      prior_context: profileFields,
    }

    const parseRes = await fetch('/api/onboarding/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsePayload),
    })
    const parsed = await parseRes.json()

    if (parsed.needs_clarification && !awaitingClarification) {
      setAwaitingClarification({
        clarificationPrompt: parsed.clarification_prompt,
        originalResponse: response,
        turnNumber: currentTurn,
        systemQuestion,
      })
      setIsProcessing(false)
      return
    }

    setAwaitingClarification(null)
    const newFields = { ...profileFields, ...parsed.extracted }
    setProfileFields(newFields)

    const isLastTurn = currentTurn === 6

    await fetch('/api/onboarding/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: candidate.candidate_id,
        fields: parsed.extracted,
        turn_number: currentTurn,
        onboarding_complete: false,
      }),
    })

    track('onboarding_turn_completed', { turn_number: currentTurn })

    if (isLastTurn) {
      // Store final fields for the summary button handler
      finalFieldsRef.current = newFields
      setCurrentTurn(7)
      setIsProcessing(false)
      return
    }

    // Fetch LLM-generated next question while still in "Reading…" state
    // Falls back to static TURNS question on error — user never notices
    try {
      const nqRes = await fetch('/api/onboarding/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed_turn: currentTurn,
          last_answer: response,
          prior_context: newFields,
        }),
      })
      const nq = await nqRes.json()
      // Batch with setCurrentTurn so they render together
      setDynamicQuestion(nq.question ?? null)
    } catch {
      setDynamicQuestion(null)
    }

    setCurrentTurn(prev => prev + 1)
    setIsProcessing(false)
  }

  async function handleStartMatching() {
    setIsStartingMatch(true)
    const fields = finalFieldsRef.current

    await fetch('/api/onboarding/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: candidate.candidate_id,
        fields,
        turn_number: 7,
        onboarding_complete: true,
      }),
    })

    track('onboarding_completed', { total_turns: 7 })

    await fetch('/api/matching/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: candidate.candidate_id }),
    })

    track('first_recommendations_viewed')
    router.push('/home')
  }

  const turnDef = TURNS[currentTurn - 1]

  // ─── Turn 7: Profile summary ───────────────────────────────────────────────
  if (currentTurn === 7) {
    const rows = buildProfileRows(finalFieldsRef.current)

    return (
      <div className="min-h-screen flex flex-col max-w-[430px] mx-auto" style={{ background: 'var(--bg)' }}>
        {/* Wordmark */}
        <div className="px-6 pt-5 pb-1 flex-shrink-0">
          <div className="text-[10px] font-extrabold tracking-[0.22em] uppercase" style={{ color: 'var(--accent)' }}>
            Stride Dash
          </div>
        </div>

        {/* Heading */}
        <div className="px-6 pt-5 pb-3 flex-shrink-0">
          <div className="text-[22px] font-extrabold tracking-tight" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Here's what I've got.
          </div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
            Tap any row to correct before we search.
          </div>
        </div>

        {/* Profile card */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {rows.map((row, i) => (
              <div
                key={i}
                className="px-5 py-3.5 flex flex-col gap-1"
                style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div
                  className="text-[10px] font-bold tracking-[0.12em] uppercase"
                  style={{ color: 'var(--text-3)' }}
                >
                  {row.label}
                </div>
                <div
                  className="text-[14px] font-medium leading-snug"
                  style={{
                    color: row.isQuote ? 'var(--text-2)' : 'var(--text-1)',
                    fontStyle: row.isQuote ? 'italic' : 'normal',
                    fontSize: row.isQuote ? '13px' : '14px',
                  }}
                >
                  {row.isQuote ? `"${row.value}"` : row.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 pb-8 pt-3 flex-shrink-0 flex flex-col gap-3">
          <button
            onClick={handleStartMatching}
            disabled={isStartingMatch}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#060C1A' }}
          >
            {isStartingMatch ? 'Finding your matches…' : 'Start my first batch'}
            {!isStartingMatch && (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9h12M9 3l6 6-6 6"/>
              </svg>
            )}
          </button>
          <div className="text-[12px] text-center" style={{ color: 'var(--text-3)' }}>
            These improve as you react to them.
          </div>
        </div>
      </div>
    )
  }

  // ─── Turns 1–6: Conversation ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col max-w-[430px] mx-auto" style={{ background: 'var(--bg)' }}>
      {/* Wordmark */}
      <div className="px-6 pt-5 pb-1 flex-shrink-0">
        <div className="text-[10px] font-extrabold tracking-[0.22em] uppercase" style={{ color: 'var(--accent)' }}>
          Stride Dash
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 flex flex-col">
        {/* Past turns history */}
        {history.length > 0 && (
          <div className="flex flex-col gap-4 pb-6 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
            {history.map((item, i) => (
              <div key={i}>
                <div className="text-[11px] font-medium mb-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
                  {item.question}
                </div>
                <div className="text-[13px] leading-snug" style={{ color: 'var(--text-2)' }}>
                  {item.answer}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clarification prompt */}
        {awaitingClarification && (
          <div className="mb-5 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-b)' }}>
            <div className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {awaitingClarification.clarificationPrompt}
            </div>
          </div>
        )}

        {/* Current question */}
        {!awaitingClarification && (
          <>
            <div
              className="text-[24px] font-extrabold leading-tight mb-2"
              style={{ color: 'var(--text-1)', letterSpacing: '-0.025em' }}
            >
              {getCurrentQuestion()}
            </div>
            {turnDef?.hint && (
              <div className="text-[13px] mb-4 italic" style={{ color: 'var(--text-3)' }}>
                {turnDef.hint}
              </div>
            )}
          </>
        )}

        {/* Chips — turn 5 only */}
        {!awaitingClarification && currentTurn === 5 && (
          <div className="flex flex-col gap-5 mb-4">
            <div>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text-3)' }}>
                Company type
              </div>
              <div className="flex flex-wrap gap-2">
                {COMPANY_CHIPS.map(chip => (
                  <button
                    key={chip.value}
                    onClick={() => {
                      setSelectedCompany(prev =>
                        prev.includes(chip.value)
                          ? prev.filter(v => v !== chip.value)
                          : [...prev, chip.value]
                      )
                    }}
                    className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
                    style={selectedCompany.includes(chip.value)
                      ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(184,255,71,0.4)' }
                      : { background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                    }
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text-3)' }}>
                Role type
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLE_CHIPS.map(chip => (
                  <button
                    key={chip.value}
                    onClick={() => setSelectedRole(chip.value)}
                    className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
                    style={selectedRole === chip.value
                      ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(184,255,71,0.4)' }
                      : { background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                    }
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        {turnDef?.inputType === 'textarea' ? (
          <textarea
            className="w-full bg-transparent resize-none outline-none text-[15px] leading-relaxed"
            style={{ color: 'var(--text-1)', caretColor: 'var(--accent)', minHeight: 80 }}
            placeholder={turnDef.placeholder}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitResponse()
              }
            }}
            autoFocus
          />
        ) : (
          <input
            className="w-full bg-transparent outline-none text-[15px]"
            style={{ color: 'var(--text-1)', caretColor: 'var(--accent)' }}
            placeholder={turnDef?.placeholder ?? ''}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitResponse()}
            autoFocus
          />
        )}
      </div>

      {/* Submit bar */}
      <div
        className="px-4 pb-6 pt-2 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            {currentTurn} / 6
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-1 rounded-full transition-colors duration-300"
                style={{ background: i < currentTurn ? 'var(--accent)' : 'var(--border-b)' }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={submitResponse}
          disabled={!canSubmit()}
          className="w-full py-3.5 rounded-2xl text-[14px] font-bold transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#060C1A' }}
        >
          {isProcessing ? 'Reading…' : awaitingClarification ? 'Answer' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

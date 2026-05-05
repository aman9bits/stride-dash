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
    placeholder: "My manager blocks everything I try to ship…",
    inputType: 'textarea' as const,
  },
  {
    number: 2,
    question: "Got it. What's your current role, and what would you say you're genuinely strongest at — your top 3 or 4 skills?",
    placeholder: "e.g. Senior PM at Flipkart, strongest at product strategy, data analysis, and stakeholder management",
    inputType: 'textarea' as const,
  },
  {
    number: 3,
    question: "Two quick ones — how many years have you been working in this field? And where are you based right now?",
    placeholder: "e.g. 7 years, based in Bangalore",
    inputType: 'text' as const,
  },
  {
    number: 4,
    question: (city: string) =>
      `Where are you looking to work? Staying in ${city || 'your city'}, open to relocating, or is remote or hybrid on the table?`,
    placeholder: "e.g. Bangalore only, open to hybrid",
    inputType: 'text' as const,
  },
  {
    number: 5,
    question: "What kind of company are you targeting? And manage a team or fly solo?",
    placeholder: "Or add anything the chips don't cover…",
    inputType: 'chips' as const,
  },
  {
    number: 6,
    question: "Last one — what's the minimum you'd consider? Not your current CTC, just the floor you'd need to say yes.",
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

interface HistoryItem { question: string; answer: string }
interface Props { candidate: CandidateProfile }

export default function OnboardingChat({ candidate }: Props) {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentTurn, setCurrentTurn] = useState(1)
  const [inputValue, setInputValue] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [profileFields, setProfileFields] = useState<Partial<CandidateProfile>>({})
  const [awaitingClarification, setAwaitingClarification] = useState<{
    clarificationPrompt: string
    originalResponse: string
    turnNumber: number
    systemQuestion: string
  } | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => { track('onboarding_started') }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [history, awaitingClarification])

  function getCurrentQuestion(): string {
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
      await showSummary(newFields)
      return
    }

    setCurrentTurn(prev => prev + 1)
    setIsProcessing(false)
  }

  async function showSummary(fields: Partial<CandidateProfile>) {
    setCurrentTurn(7)

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
    setTimeout(() => router.push('/home'), 1500)
    setIsProcessing(false)
  }

  const turnDef = TURNS[currentTurn - 1]

  // ─── Summary / loading screen ──────────────────────────────────────────────
  if (currentTurn === 7) {
    return (
      <div className="min-h-screen flex flex-col max-w-[430px] mx-auto" style={{ background: 'var(--bg)' }}>
        <div className="px-6 pt-5">
          <div className="text-[10px] font-extrabold tracking-[0.22em] uppercase" style={{ color: 'var(--accent)' }}>
            Stride Dash
          </div>
        </div>
        <div className="px-6 pt-5">
          <div className="text-[22px] font-extrabold tracking-tight" style={{ color: 'var(--text-1)' }}>
            Here's what I've got.
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Finding your matches now…</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: 'var(--accent)', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

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
          <div className="text-[24px] font-extrabold leading-tight mb-4"
            style={{ color: 'var(--text-1)', letterSpacing: '-0.025em' }}>
            {getCurrentQuestion()}
          </div>
        )}

        {/* Chips — turn 5 only */}
        {!awaitingClarification && currentTurn === 5 && (
          <div className="flex flex-col gap-5 mb-4">
            <div>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2.5" style={{ color: 'var(--text-3)' }}>
                Company type
              </div>
              <div className="flex flex-wrap gap-2">
                {COMPANY_CHIPS.map(chip => {
                  const active = selectedCompany.includes(chip.value)
                  return (
                    <button key={chip.value}
                      onClick={() => setSelectedCompany(prev =>
                        active ? prev.filter(v => v !== chip.value) : [...prev, chip.value])}
                      className="text-[13px] font-medium rounded-full px-4 py-2 border transition-all"
                      style={{
                        background: active ? 'var(--accent-dim)' : 'transparent',
                        borderColor: active ? 'var(--accent)' : 'var(--border-b)',
                        color: active ? 'var(--accent)' : 'var(--text-2)',
                      }}>
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2.5" style={{ color: 'var(--text-3)' }}>
                Role type
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLE_CHIPS.map(chip => {
                  const active = selectedRole === chip.value
                  return (
                    <button key={chip.value}
                      onClick={() => setSelectedRole(prev => prev === chip.value ? '' : chip.value)}
                      className="text-[13px] font-medium rounded-full px-4 py-2 border transition-all"
                      style={{
                        background: active ? 'var(--accent-dim)' : 'transparent',
                        borderColor: active ? 'var(--accent)' : 'var(--border-b)',
                        color: active ? 'var(--accent)' : 'var(--text-2)',
                      }}>
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: 'var(--text-3)', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-8 pt-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div className="flex gap-2.5 items-end">
          {turnDef?.inputType !== 'text' ? (
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitResponse() } }}
              placeholder={awaitingClarification ? 'Your answer…' : (turnDef?.placeholder ?? '')}
              rows={currentTurn === 5 ? 1 : 2}
              disabled={isProcessing}
              className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm leading-relaxed outline-none no-scrollbar transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-b)', color: 'var(--text-1)' }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-b)' }}
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitResponse() }}
              placeholder={awaitingClarification ? 'Your answer…' : (turnDef?.placeholder ?? '')}
              disabled={isProcessing}
              className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-b)', color: 'var(--text-1)' }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-b)' }}
            />
          )}
          <button
            onClick={submitResponse}
            disabled={!canSubmit()}
            className="w-[50px] h-[50px] rounded-2xl flex items-center justify-center flex-shrink-0 transition-opacity"
            style={{ background: canSubmit() ? 'var(--accent)' : 'var(--surface)', opacity: isProcessing ? 0.5 : 1 }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
              stroke={canSubmit() ? '#060C1A' : 'var(--text-3)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h12M10 4l6 6-6 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

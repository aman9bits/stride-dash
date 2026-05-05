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
    placeholder: "Tell me what's going on...",
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
    question: (currentCity: string) =>
      `Where are you looking to work? Staying in ${currentCity || 'your city'}, open to relocating, or is remote or hybrid on the table?`,
    placeholder: "e.g. Bangalore only, open to hybrid",
    inputType: 'text' as const,
  },
  {
    number: 5,
    question: "What kind of company are you targeting — product startups, funded scaleups, large tech? And are you looking to manage a team, operate more independently, or a mix?",
    placeholder: "e.g. Product startups or Series B-D, want to manage a small team",
    inputType: 'textarea' as const,
  },
  {
    number: 6,
    question: "Last one — what's the minimum you'd consider? Not your current CTC, just the floor you'd need to say yes.",
    placeholder: "e.g. 70 LPA",
    inputType: 'text' as const,
  },
]

interface Message {
  role: 'system' | 'user' | 'clarification'
  content: string
}

interface Props {
  candidate: CandidateProfile
}

export default function OnboardingChat({ candidate }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [currentTurn, setCurrentTurn] = useState(candidate.onboarding_turn + 1)
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [profileFields, setProfileFields] = useState<Partial<CandidateProfile>>({})
  const [awaitingClarification, setAwaitingClarification] = useState<{
    clarificationPrompt: string
    originalResponse: string
    turnNumber: number
    systemQuestion: string
  } | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  // Send first question on mount
  useEffect(() => {
    const turn = TURNS[0]
    setMessages([{ role: 'system', content: turn.question as string }])
    track('onboarding_started')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    inputRef.current?.focus()
  }, [messages])

  function getCurrentTurnDef() {
    return TURNS[currentTurn - 1]
  }

  function getQuestion(turn: typeof TURNS[0]): string {
    if (typeof turn.question === 'function') {
      return turn.question(profileFields.current_location ?? '')
    }
    return turn.question
  }

  async function submitResponse(response: string, isClarification = false) {
    if (!response.trim() || isProcessing) return
    setIsProcessing(true)
    setInputValue('')

    const turn = TURNS[currentTurn - 1]
    const systemQuestion = getQuestion(turn)

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: response }])

    // Parse the response
    const parsePayload = {
      candidate_id: candidate.candidate_id,
      session_id: sessionId,
      turn_number: currentTurn,
      system_question: isClarification ? awaitingClarification!.systemQuestion : systemQuestion,
      candidate_response: isClarification ? awaitingClarification!.originalResponse : response,
      clarification_sent: isClarification ? awaitingClarification!.clarificationPrompt : undefined,
      clarification_response: isClarification ? response : undefined,
      prior_context: profileFields,
    }

    const parseRes = await fetch('/api/onboarding/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsePayload),
    })
    const parsed = await parseRes.json()

    // If clarification needed and not already in clarification flow
    if (parsed.needs_clarification && !isClarification) {
      setAwaitingClarification({
        clarificationPrompt: parsed.clarification_prompt,
        originalResponse: response,
        turnNumber: currentTurn,
        systemQuestion,
      })
      setMessages(prev => [...prev, { role: 'clarification', content: parsed.clarification_prompt }])
      setIsProcessing(false)
      return
    }

    setAwaitingClarification(null)

    // Merge extracted fields
    const newFields = { ...profileFields, ...parsed.extracted }
    setProfileFields(newFields)

    // Save to DB
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

    track('onboarding_turn_completed', {
      turn_number: currentTurn,
      fields_captured: Object.keys(parsed.extracted ?? {}),
    })

    if (isLastTurn) {
      // Show summary (Turn 7)
      await showSummary(newFields)
      return
    }

    // Advance to next turn
    const nextTurn = TURNS[currentTurn]
    const nextQuestion = typeof nextTurn.question === 'function'
      ? nextTurn.question(newFields.current_location ?? '')
      : nextTurn.question

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'system', content: nextQuestion }])
      setCurrentTurn(prev => prev + 1)
      setIsProcessing(false)
    }, 400)
  }

  async function showSummary(fields: Partial<CandidateProfile>) {
    const summary = `Here's what I've got from you. Let me know if anything looks off.

**You:** ${fields.current_role_title ?? '—'}, ${fields.total_experience_years ?? '—'} years, based in ${fields.current_location ?? '—'}.
**Looking for:** ${(fields.target_company_types ?? []).join(', ')} companies, ${fields.target_role_type ?? '—'} role in ${(fields.location_preference ?? []).join(', ') || '—'}.
**Floor:** ₹${fields.salary_floor_lpa ?? '—'}L+
**What's driving the search:** ${fields.what_is_broken ?? '—'}

I'm generating your first 3 matches now.`

    setMessages(prev => [...prev, { role: 'system', content: summary }])
    setCurrentTurn(7)

    // Complete onboarding and trigger matching
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

    // Trigger matching run
    await fetch('/api/matching/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: candidate.candidate_id }),
    })

    track('first_recommendations_viewed')

    setTimeout(() => router.push('/home'), 2000)
    setIsProcessing(false)
  }

  const turnDef = getCurrentTurnDef()
  const inputType = turnDef?.inputType ?? 'text'

  return (
    <div className="min-h-screen flex flex-col bg-white max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Stride Dash</span>
          {currentTurn <= 6 && (
            <span className="text-xs text-gray-400">{currentTurn} of 6</span>
          )}
        </div>
        {currentTurn <= 6 && (
          <div className="mt-2 h-1 bg-gray-100 rounded-full">
            <div
              className="h-1 bg-gray-900 rounded-full transition-all duration-500"
              style={{ width: `${(currentTurn / 6) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-gray-900 text-white rounded-br-sm'
                : msg.role === 'clarification'
                ? 'bg-blue-50 text-blue-900 rounded-bl-sm border border-blue-100'
                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {currentTurn <= 6 && (
        <div className="border-t border-gray-100 px-4 py-3 bg-white">
          <div className="flex gap-2 items-end">
            {inputType === 'textarea' ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submitResponse(inputValue, !!awaitingClarification)
                  }
                }}
                placeholder={awaitingClarification ? 'Your answer...' : (turnDef?.placeholder ?? '')}
                rows={3}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-gray-50"
                disabled={isProcessing}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitResponse(inputValue, !!awaitingClarification)
                }}
                placeholder={awaitingClarification ? 'Your answer...' : (turnDef?.placeholder ?? '')}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:border-gray-400 bg-gray-50"
                disabled={isProcessing}
              />
            )}
            <button
              onClick={() => submitResponse(inputValue, !!awaitingClarification)}
              disabled={!inputValue.trim() || isProcessing}
              className="bg-gray-900 text-white rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-40 active:scale-95 transition-transform shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

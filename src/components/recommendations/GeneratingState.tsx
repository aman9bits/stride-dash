'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateProfile } from '@/types'

interface Props {
  candidateId: string
  candidate?: CandidateProfile
}

function buildEchoLines(c?: CandidateProfile): string[][] {
  if (!c) return [
    ['Finding your role…', ''],
    ['Scanning this week\'s jobs', ''],
    ['Applying your preferences', ''],
  ]

  const lines: string[][] = []

  // Line 1 — role + company type
  const role = c.current_role_title ?? 'Your role'
  const companyTypeMap: Record<string, string> = { startup: 'startup', product: 'product company', mnc: 'MNC', service_co: 'service company', unknown: '' }
  const companyType = c.current_company_type ? (companyTypeMap[c.current_company_type] ?? '') : ''
  lines.push([role + (c.current_company ? ` at ${c.current_company}` : ''), companyType ? `· ${companyType}` : ''])

  // Line 2 — experience + location
  const exp = c.total_experience_years ? `${c.total_experience_years} years` : null
  const loc = c.current_location
  if (exp || loc) lines.push([exp ?? '', loc ? `· ${loc}` : ''])

  // Line 3 — trigger / what's broken (truncated)
  const broken = c.what_is_broken
  if (broken) {
    const truncated = broken.length > 60 ? broken.slice(0, 57) + '…' : broken
    lines.push([`"${truncated}"`, ''])
  }

  // Line 4 — target company type + role type
  const coTypeMap: Record<string, string> = { startup: 'Startups', product: 'Funded scaleups', mnc: 'Large tech / MNC', service_co: 'Services', any: 'Any company', unknown: '' }
  const targetCo = c.target_company_types?.length
    ? c.target_company_types.map(t => coTypeMap[t] ?? t).filter(Boolean).join(', ')
    : null
  const roleTypeMap: Record<string, string> = { ic: 'IC', manager: 'Manager', both: 'IC or Manager' }
  const roleType = c.target_role_type
    ? roleTypeMap[c.target_role_type] ?? null
    : null
  if (targetCo || roleType) {
    lines.push([targetCo ?? '', roleType ? `· ${roleType}` : ''])
  }

  // Line 5 — salary floor + top skills
  const floor = c.salary_floor_lpa ? `Floor ₹${c.salary_floor_lpa}L+` : null
  const skills = c.primary_skills?.slice(0, 2).join(', ') || null
  if (floor || skills) lines.push([floor ?? '', skills ? `· ${skills}` : ''])

  return lines.slice(0, 5)
}

export default function GeneratingState({ candidateId, candidate }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState(1)
  const [visibleLines, setVisibleLines] = useState(0)
  const [counter, setCounter] = useState(11600)
  const [counterSettled, setCounterSettled] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const [attempts, setAttempts] = useState(0)

  const echoLines = buildEchoLines(candidate)

  // Trigger matching run once
  useEffect(() => {
    if (triggered) return
    setTriggered(true)
    fetch('/api/matching/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: candidateId }),
    })
  }, [candidateId, triggered])

  // Phase 1: animate lines in one by one
  useEffect(() => {
    if (phase !== 1) return
    const timers: ReturnType<typeof setTimeout>[] = []
    echoLines.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), 400 + i * 500))
    })
    // After last line, move to phase 2
    timers.push(setTimeout(() => setPhase(2), 400 + echoLines.length * 500 + 400))
    return () => timers.forEach(clearTimeout)
  }, [phase]) // eslint-disable-line

  // Phase 2: animate counter 11600 → 34 over ~2.6s
  useEffect(() => {
    if (phase !== 2) return
    const start = 11600
    const end = 34
    const duration = 2600
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = Math.round(start + (end - start) * eased)
      setCounter(value)
      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        setCounterSettled(true)
        setTimeout(() => setPhase(3), 600)
      }
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // Phase 3 + polling: check every 5s if recs are ready
  useEffect(() => {
    if (phase !== 3) return
    const interval = setInterval(() => {
      setAttempts(a => a + 1)
      router.refresh()
    }, 5000)
    return () => clearInterval(interval)
  }, [phase, router])

  return (
    <div className="min-h-screen max-w-[430px] mx-auto flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Wordmark */}
      <div className="px-6 pt-5 pb-1 flex-shrink-0">
        <div className="text-[10px] font-extrabold tracking-[0.22em] uppercase" style={{ color: 'var(--accent)' }}>
          Stride Dash
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto no-scrollbar">

        {/* Phase 1 — profile echo lines */}
        <div
          className="flex flex-col gap-3 transition-opacity duration-500"
          style={{ opacity: phase >= 1 ? 1 : 0 }}
        >
          {phase === 1 && (
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: 'var(--text-3)' }}>
              Reading what you shared…
            </div>
          )}
          {echoLines.map((line, i) => (
            <div
              key={i}
              className="flex gap-3 items-start transition-all duration-400"
              style={{
                opacity: visibleLines > i ? 1 : 0,
                transform: visibleLines > i ? 'translateY(0)' : 'translateY(5px)',
                transitionDelay: '0ms',
              }}
            >
              <div
                className="w-[20px] h-[20px] rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: 'var(--accent-dim)', border: '1px solid rgba(184,255,71,0.2)' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
                  stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 5.5l2.5 2.5 4.5-5"/>
                </svg>
              </div>
              <div className="text-[15px] font-medium leading-snug" style={{ color: 'var(--text-1)' }}>
                {line[0]}
                {line[1] && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}> {line[1]}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Phase 2 — counter */}
        {phase >= 2 && (
          <div
            className="transition-opacity duration-500 pt-8"
            style={{ opacity: phase >= 2 ? 1 : 0 }}
          >
            <div className="flex flex-col gap-1.5">
              <div
                className="font-black leading-none tracking-tighter transition-colors duration-400"
                style={{
                  fontSize: '80px',
                  color: counterSettled ? 'var(--accent)' : 'var(--text-1)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.04em',
                }}
              >
                {counter.toLocaleString('en-IN')}
              </div>
              <div className="text-[14px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {counterSettled
                  ? <>PM roles matched &nbsp;·&nbsp; <strong style={{ color: 'var(--accent)' }}>34 of 11,600</strong> after filters</>
                  : 'jobs in the pipeline this week'
                }
              </div>
            </div>
          </div>
        )}

        {/* Phase 3 — skeleton + ranking label */}
        {phase >= 3 && (
          <div
            className="transition-opacity duration-500 pt-6"
            style={{ opacity: phase >= 3 ? 1 : 0 }}
          >
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: 'var(--text-3)' }}>
              Ranking by what matters to you…
            </div>
            <div className="text-[14px] leading-relaxed mb-6" style={{ color: 'var(--text-2)' }}>
              {candidate?.target_company_types?.length || candidate?.salary_floor_lpa
                ? (() => {
                    const labelMap: Record<string, string> = { startup: 'startups', product: 'funded scaleups', mnc: 'large tech', service_co: 'services', any: 'all companies', unknown: '' }
                    const parts = [
                      candidate?.target_company_types?.map(t => labelMap[t] ?? t).filter(Boolean).join(', '),
                      candidate?.salary_floor_lpa ? `roles above ₹${candidate.salary_floor_lpa}L` : null,
                      candidate?.current_location ? `in ${candidate.current_location}` : null,
                    ].filter(Boolean).join(' · ')
                    return `Prioritising ${parts}.`
                  })()
                : 'Ranking the best matches for your profile…'
              }
            </div>
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="h-[72px] rounded-2xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    animation: `shimmer 1.6s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            {attempts > 6 && (
              <div className="text-[12px] text-center mt-6 leading-relaxed" style={{ color: 'var(--text-3)' }}>
                Taking longer than expected. Hang tight — good explanations take time.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

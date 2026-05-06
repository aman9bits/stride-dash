'use client'

import { useState, useEffect, useRef } from 'react'
import type { Recommendation, Job } from '@/types'
import DismissChips from './DismissChips'
import AskWhyView from './AskWhyView'
import ApplySheet from './ApplySheet'

interface Props {
  rec: Recommendation
  job: Job
  runnerUp: (Recommendation & { job: Job }) | null
  candidateId: string
}

type CardState = 'default' | 'expanded' | 'undoable' | 'dismissing' | 'dismissed' | 'applying' | 'ask_why'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCompanyBadge(type: string | null, stage?: string | null): { label: string; style: React.CSSProperties } {
  const stageLabel = stage ? ` · ${stage}` : ''
  const map: Record<string, { label: string; style: React.CSSProperties }> = {
    startup:    { label: `Startup${stageLabel}`,   style: { background: 'rgba(255,140,66,0.12)', color: 'var(--orange)' } },
    product:    { label: 'Product company',         style: { background: 'rgba(91,142,255,0.12)', color: 'var(--blue)' } },
    mnc:        { label: 'MNC',                     style: { background: 'rgba(138,158,197,0.12)', color: 'var(--text-2)' } },
    service_co: { label: 'Services co',             style: { background: 'rgba(138,158,197,0.12)', color: 'var(--text-2)' } },
    unknown:    { label: 'Stage unknown',           style: { background: 'rgba(138,158,197,0.08)', color: 'var(--text-3)' } },
  }
  return map[type ?? 'unknown'] ?? map.unknown
}

function getJobAge(days: number | null): { text: string; stale: boolean } | null {
  if (!days || days <= 14) return null
  if (days < 30) return { text: `${Math.round(days / 7)} weeks ago`, stale: false }
  if (days < 60) return { text: `Open ${Math.round(days / 7)} weeks — ask why it's still open`, stale: true }
  if (days < 90) return { text: `Open ${Math.floor(days / 30)}+ months — slow process or high bar`, stale: true }
  return { text: `Open ${Math.floor(days / 30)}+ months — worth investigating first`, stale: true }
}

function getLocation(job: Job): string {
  if (job.is_pan_india) return 'Remote / Pan-India'
  return job.locations?.slice(0, 2).join(', ') || 'Location TBC'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecommendationCard({ rec, job, runnerUp, candidateId }: Props) {
  const [state, setState] = useState<CardState>('default')
  const [hasApplied, setHasApplied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const prevStateRef = useRef<CardState>('default')
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 5-second undo window before dismiss chips appear
  useEffect(() => {
    if (state !== 'undoable') return
    undoTimerRef.current = setTimeout(() => setState('dismissing'), 5000)
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [state])

  async function callReaction(
    reaction_type: 'apply' | 'dismiss' | 'ask_why',
    opts?: { dismiss_reason?: string }
  ) {
    return fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: candidateId,
        rec_id: rec.rec_id,
        job_id: rec.job_id,
        reaction_type,
        company_name: job.company_name,
        company_type: job.company_type,
        job_title: job.title,
        ...opts,
      }),
    })
  }

  function handleDismissStart() {
    prevStateRef.current = state
    setState('undoable')
  }

  function handleUndoDismiss() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setState(prevStateRef.current === 'expanded' ? 'expanded' : 'default')
  }

  async function handleDismissConfirm(reason: string) {
    setIsLoading(true)
    await callReaction('dismiss', { dismiss_reason: reason })
    setIsLoading(false)
    setState('dismissed')
  }

  function handleApplyStart() {
    prevStateRef.current = state
    setState('applying')
  }

  async function handleApplyConfirm() {
    setIsLoading(true)
    await callReaction('apply')
    setIsLoading(false)
    setHasApplied(true)
    setState(prevStateRef.current === 'expanded' ? 'expanded' : 'default')
  }

  function handleApplyClose() {
    setState(prevStateRef.current === 'expanded' ? 'expanded' : 'default')
  }

  async function handleAskWhy() {
    await callReaction('ask_why')
    prevStateRef.current = state
    setState('ask_why')
  }

  const badge = getCompanyBadge(job.company_type, job.stage)
  const ageInfo = getJobAge(job.job_age_days)
  const previewText = rec.why_it_fits[0] ?? ''
  const isExpanded = state === 'expanded' || state === 'ask_why'
  const locationLine = [
    job.company_name ?? 'Company undisclosed',
    getLocation(job),
    job.role_level ?? null,
  ].filter(Boolean).join(' · ')

  // ─── Undo state ────────────────────────────────────────────────────────────
  if (state === 'undoable') {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[13px] line-through" style={{ color: 'var(--text-3)' }}>
            {job.title}{job.company_name ? ` at ${job.company_name}` : ''}
          </span>
          <button
            onClick={handleUndoDismiss}
            className="text-[12px] font-semibold flex-shrink-0 ml-3"
            style={{ color: 'var(--accent)' }}
          >
            Undo
          </button>
        </div>
      </div>
    )
  }

  // ─── Dismissed ─────────────────────────────────────────────────────────────
  if (state === 'dismissed') {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center px-4 py-3.5">
          <span className="text-[13px] line-through" style={{ color: 'var(--text-3)' }}>
            {job.title}{job.company_name ? ` at ${job.company_name}` : ''}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--surface)',
        border: isExpanded ? '1px solid rgba(184,255,71,0.3)' : '1px solid var(--border)',
        boxShadow: isExpanded ? '0 0 0 1px rgba(184,255,71,0.08), 0 8px 24px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {/* Card top — tappable to expand/collapse */}
      <div
        className="px-4 pt-4 pb-0 cursor-pointer select-none"
        onClick={() => {
          if (state === 'default') setState('expanded')
          else if (state === 'expanded') setState('default')
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-md"
            style={badge.style}
          >
            {badge.label}
          </span>
          {ageInfo && (
            <span className="text-[11px] font-medium" style={{ color: ageInfo.stale ? 'var(--orange)' : 'var(--text-3)' }}>
              {ageInfo.text}
            </span>
          )}
        </div>
        <div className="text-[16px] font-bold mb-0.5 leading-snug" style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          {job.title}
        </div>
        <div className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>
          {locationLine}
        </div>
      </div>

      {/* Preview blurb — collapsed only */}
      {state === 'default' && previewText && (
        <div
          className="px-4 pb-3 cursor-pointer"
          style={{ borderBottom: '1px solid var(--border)' }}
          onClick={() => setState('expanded')}
        >
          <div className="text-[13px] leading-relaxed line-clamp-2" style={{ color: 'var(--text-2)' }}>
            "{previewText}"
          </div>
          <div className="text-[11px] font-semibold mt-1.5" style={{ color: 'var(--text-3)' }}>
            Tap to read full match ↓
          </div>
        </div>
      )}

      {/* Expanded body */}
      {isExpanded && state !== 'ask_why' && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Why it fits */}
          <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: 'var(--text-3)' }}>
              Why this fits you
            </div>
            <div className="flex flex-col gap-3">
              {rec.why_it_fits.map((bullet, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-0.5 rounded-full flex-shrink-0 self-stretch mt-1" style={{ background: 'var(--accent)', minHeight: 16 }} />
                  <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-1)' }}>{bullet}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Uncertainty */}
          {rec.uncertainty_flags.length > 0 && (
            <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: 'var(--text-3)' }}>
                What we're uncertain about
              </div>
              <div className="flex flex-col gap-2.5">
                {rec.uncertainty_flags.map((flag, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-0.5 rounded-full flex-shrink-0 self-stretch mt-1" style={{ background: 'var(--orange)', minHeight: 16 }} />
                    <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{flag}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter summary */}
          {rec.filter_summary && (
            <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text-3)' }}>
                How we got here
              </div>
              <div className="text-[12px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                {rec.filter_summary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ask Why inline view */}
      {state === 'ask_why' && (
        <AskWhyView rec={rec} job={job} runnerUp={runnerUp} onClose={() => setState('expanded')} />
      )}

      {/* Apply sheet inline view */}
      {state === 'applying' && (
        <ApplySheet
          job={job}
          onConfirm={handleApplyConfirm}
          onClose={handleApplyClose}
          isLoading={isLoading}
        />
      )}

      {/* Dismiss chips */}
      {state === 'dismissing' && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <DismissChips onConfirm={handleDismissConfirm} isLoading={isLoading} />
        </div>
      )}

      {/* Action buttons */}
      {state !== 'dismissing' && state !== 'ask_why' && state !== 'applying' && (
        <div className="flex gap-2 px-3.5 py-3">
          <button
            onClick={hasApplied ? undefined : handleApplyStart}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold transition-all disabled:opacity-50"
            style={hasApplied
              ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(184,255,71,0.3)' }
              : { background: 'var(--accent)', color: '#060C1A' }
            }
          >
            {hasApplied ? '✓ Applied' : 'Apply →'}
          </button>
          <button
            onClick={handleDismissStart}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'transparent', border: '1px solid var(--border-b)', color: 'var(--text-2)' }}
          >
            Dismiss
          </button>
          <button
            onClick={handleAskWhy}
            disabled={isLoading}
            className="flex-1 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-2)' }}
          >
            Ask why
          </button>
        </div>
      )}
    </div>
  )
}

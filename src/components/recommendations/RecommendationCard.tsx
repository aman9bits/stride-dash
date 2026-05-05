'use client'

import { useState } from 'react'
import type { Recommendation, Job } from '@/types'
import DismissChips from './DismissChips'
import AskWhyView from './AskWhyView'

interface Props {
  rec: Recommendation
  job: Job
  runnerUp: (Recommendation & { job: Job }) | null
  candidateId: string
}

type CardState = 'default' | 'dismissing' | 'dismissed' | 'applied' | 'ask_why'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCompanyBadge(type: string | null): string {
  const map: Record<string, string> = {
    startup: 'Startup',
    product: 'Product company',
    mnc: 'MNC',
    service_co: 'Services company',
    unknown: 'Company type unknown',
  }
  return map[type ?? 'unknown'] ?? 'Company type unknown'
}

function getJobAgeDisplay(days: number | null): { text: string; isWarning: boolean } | null {
  if (!days || days <= 14) return null
  if (days < 30) return { text: `Posted ${Math.round(days / 7)} weeks ago`, isWarning: false }
  if (days < 60) return { text: `Open ${Math.round(days / 7)} weeks — ask why it's still open`, isWarning: true }
  if (days < 90) return { text: `Open ${Math.floor(days / 30)}+ months — slow process or high bar`, isWarning: true }
  return { text: `Open ${Math.floor(days / 30)}+ months — worth investigating before applying`, isWarning: true }
}

function getLocationDisplay(job: Job): string {
  if (job.is_pan_india) return 'Remote / Pan-India'
  return job.locations?.slice(0, 2).join(', ') || 'Location not specified'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecommendationCard({ rec, job, runnerUp, candidateId }: Props) {
  const [state, setState] = useState<CardState>('default')
  const [isLoading, setIsLoading] = useState(false)

  async function callReaction(
    reaction_type: 'apply' | 'dismiss' | 'ask_why',
    opts?: { dismiss_reason?: string; apply_reason?: string }
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

  async function handleApply() {
    setIsLoading(true)
    await callReaction('apply')
    setIsLoading(false)
    setState('applied')
  }

  async function handleDismiss(reason: string) {
    setIsLoading(true)
    await callReaction('dismiss', { dismiss_reason: reason })
    setIsLoading(false)
    setState('dismissed')
  }

  async function handleAskWhy() {
    await callReaction('ask_why')
    setState('ask_why')
  }

  // ─── Collapsed states ──────────────────────────────────────────────────────

  if (state === 'dismissed') {
    return (
      <div className="px-4 py-4 flex items-center gap-3">
        <span className="text-sm text-gray-400 flex-1">
          Dismissed — {job.title}{job.company_name ? ` at ${job.company_name}` : ''}
        </span>
      </div>
    )
  }

  if (state === 'applied') {
    return (
      <div className="px-4 py-5">
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800">✓ Marked as applied</p>
          <p className="text-sm text-green-700 mt-0.5">
            {job.title}{job.company_name ? ` at ${job.company_name}` : ''}
          </p>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Your application is tracked. The actual application happens on the company's site — we won't show this role again.
          </p>
        </div>
      </div>
    )
  }

  // ─── Full card ─────────────────────────────────────────────────────────────

  const ageDisplay = getJobAgeDisplay(job.job_age_days)

  return (
    <div className="px-4 py-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 shrink-0">
          {getCompanyBadge(job.company_type)}
        </span>
        {ageDisplay && (
          <span className={`text-xs text-right leading-snug ${ageDisplay.isWarning ? 'text-amber-500' : 'text-gray-400'}`}>
            {ageDisplay.text}
          </span>
        )}
      </div>

      {/* Role + company */}
      <h2 className="text-base font-semibold text-gray-900 leading-snug">
        {job.title}
      </h2>
      <p className="text-sm text-gray-500 mt-0.5">
        {job.company_name ?? 'Company undisclosed'} · {getLocationDisplay(job)}
      </p>

      {/* Why it fits */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Why this fits you
        </p>
        <ul className="space-y-2.5">
          {rec.why_it_fits.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
              <span className="text-gray-300 shrink-0 mt-0.5">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Uncertainty flags */}
      {rec.uncertainty_flags.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            What we're uncertain about
          </p>
          <ul className="space-y-2">
            {rec.uncertainty_flags.map((flag, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 leading-relaxed"
              >
                <span className="shrink-0">⚠</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter summary */}
      {rec.filter_summary && (
        <p className="mt-4 text-xs text-gray-400 leading-relaxed">
          {rec.filter_summary}
        </p>
      )}

      {/* Actions or expanded views */}
      {state === 'dismissing' ? (
        <DismissChips
          onConfirm={handleDismiss}
          onCancel={() => setState('default')}
          isLoading={isLoading}
        />
      ) : state === 'ask_why' ? (
        <AskWhyView
          rec={rec}
          job={job}
          runnerUp={runnerUp}
          onClose={() => setState('default')}
        />
      ) : (
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleApply}
            disabled={isLoading}
            className="flex-1 bg-gray-900 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 active:scale-95 transition-transform"
          >
            Apply
          </button>
          <button
            onClick={() => setState('dismissing')}
            disabled={isLoading}
            className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium active:scale-95 transition-transform disabled:opacity-40"
          >
            Dismiss
          </button>
          <button
            onClick={handleAskWhy}
            disabled={isLoading}
            className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium active:scale-95 transition-transform disabled:opacity-40"
          >
            Ask why
          </button>
        </div>
      )}
    </div>
  )
}

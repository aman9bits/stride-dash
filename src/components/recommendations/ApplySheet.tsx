'use client'

import { useState } from 'react'
import type { Job } from '@/types'

interface Props {
  job: Job
  onConfirm: () => void
  onClose: () => void
  isLoading: boolean
}

const BADGE_STYLE: Record<string, React.CSSProperties> = {
  startup: { background: 'rgba(255,140,66,0.12)', color: 'var(--orange)' },
  product: { background: 'rgba(91,142,255,0.12)', color: 'var(--blue)' },
  mnc:     { background: 'rgba(138,158,197,0.12)', color: 'var(--text-2)' },
  service_co: { background: 'rgba(138,158,197,0.12)', color: 'var(--text-2)' },
  unknown: { background: 'rgba(138,158,197,0.08)', color: 'var(--text-3)' },
}

export default function ApplySheet({ job, onConfirm, onClose, isLoading }: Props) {
  const [notifyClicked, setNotifyClicked] = useState(false)
  const badgeStyle = BADGE_STYLE[job.company_type ?? 'unknown'] ?? BADGE_STYLE.unknown
  const companyLabel = [job.company_name, job.stage].filter(Boolean).join(' · ')

  function handleGoToApplication() {
    if (job.job_url) {
      window.open(job.job_url, '_blank', 'noopener,noreferrer')
    }
    onConfirm()
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1 cursor-pointer" onClick={onClose}>
        <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border-b)' }} />
      </div>

      <div className="px-5 pb-8">
        {/* Job context tag */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-md"
            style={badgeStyle}
          >
            {companyLabel || 'Company'}
          </span>
        </div>

        <div className="text-[18px] font-extrabold tracking-tight mb-1" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          Ready to apply?
        </div>
        <div className="text-[13px] mb-5" style={{ color: 'var(--text-3)' }}>
          {job.title}{job.company_name ? ` · ${job.company_name}` : ''}
        </div>

        {/* Redirect CTA */}
        <button
          onClick={handleGoToApplication}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold mb-3 transition-opacity disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#060C1A' }}
        >
          Go to {job.company_name ?? 'company'}'s application
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5h10M8.5 3.5l5 5-5 5"/>
          </svg>
        </button>

        <div className="text-[11px] text-center mb-6" style={{ color: 'var(--text-3)' }}>
          Opens in browser · We'll mark this as applied when you return.
        </div>

        {/* Application strategy — coming soon */}
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{ border: '1px dashed var(--border-b)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(91,142,255,0.04), rgba(184,255,71,0.03))' }}
          />
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--text-2)' }}>
              Application strategy
            </div>
            <span
              className="text-[9px] font-extrabold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full"
              style={{ color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid rgba(91,142,255,0.2)' }}
            >
              Coming soon
            </span>
          </div>

          <div className="text-[15px] font-bold mb-2 leading-snug" style={{ color: 'var(--text-1)' }}>
            How to approach this application — tailored to your profile
          </div>
          <div className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--text-3)' }}>
            What to lead with, which skills to surface first, and questions that signal you've done the work.
          </div>

          <div className="flex flex-col gap-2 mb-4 opacity-45">
            {[
              `What to lead with given what ${job.company_name ?? 'this company'} is currently prioritising`,
              'Which 2 of your skills to surface most prominently in your resume for this JD',
              '3 questions to ask in the first call that will set you apart',
            ].map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: 'var(--blue)' }} />
                <div className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{item}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setNotifyClicked(true)}
            disabled={notifyClicked}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:cursor-default"
            style={notifyClicked
              ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(184,255,71,0.3)' }
              : { background: 'transparent', color: 'var(--blue)', border: '1px solid rgba(91,142,255,0.3)' }
            }
          >
            {notifyClicked ? '✓ We\'ll let you know' : 'Notify me when this launches'}
          </button>
        </div>
      </div>
    </div>
  )
}

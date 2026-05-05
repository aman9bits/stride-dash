'use client'

import type { Recommendation, Job } from '@/types'

interface Props {
  rec: Recommendation
  job: Job
  runnerUp: (Recommendation & { job: Job }) | null
  onClose: () => void
}

export default function AskWhyView({ rec, job, runnerUp, onClose }: Props) {
  return (
    <div className="relative" style={{ borderTop: '1px solid var(--border)' }}>
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1 cursor-pointer" onClick={onClose}>
        <div className="w-9 h-1 rounded-full" style={{ background: 'var(--border-b)' }} />
      </div>

      <div className="px-5 pb-6 overflow-y-auto no-scrollbar max-h-[60vh]">
        <div className="text-[18px] font-extrabold tracking-tight mb-1" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          Why we picked this for you
        </div>
        <div className="text-[13px] mb-5" style={{ color: 'var(--text-3)' }}>
          {job.company_name ?? 'Company'} · {job.title}
        </div>

        {/* How we matched */}
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text-3)' }}>
          How we matched this
        </div>
        <p className="text-[13px] leading-relaxed mb-5" style={{ color: 'var(--text-2)' }}>
          {rec.filter_summary}
        </p>

        {/* Why bullets */}
        <div className="flex flex-col gap-4 mb-5">
          {rec.why_it_fits.map((bullet, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: 'var(--accent-dim)', border: '1px solid rgba(184,255,71,0.2)' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5.5"/>
                </svg>
              </div>
              <div className="text-[14px] leading-relaxed" style={{ color: 'var(--text-1)' }}>{bullet}</div>
            </div>
          ))}
        </div>

        {/* Uncertainty */}
        {rec.uncertainty_flags.length > 0 && (
          <>
            <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: 'var(--text-3)' }}>
              What we're not sure about
            </div>
            <div className="flex flex-col gap-2.5 mb-5">
              {rec.uncertainty_flags.map((flag, i) => (
                <div key={i} className="flex gap-2.5 rounded-xl p-3"
                  style={{ background: 'var(--orange-dim)', border: '1px solid rgba(255,140,66,0.18)' }}>
                  <span className="text-sm flex-shrink-0">⚠</span>
                  <span className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{flag}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Runner-up */}
        {runnerUp && runnerUp.runner_up_reason && (
          <>
            <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: 'var(--text-3)' }}>
              Next-closest match we considered
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase block mb-1.5" style={{ color: 'var(--red)' }}>
                Ranked lower because →
              </span>
              <div className="text-[14px] font-bold mb-1.5" style={{ color: 'var(--text-1)' }}>
                {runnerUp.job.title}{runnerUp.job.company_name ? ` at ${runnerUp.job.company_name}` : ''}
              </div>
              <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {runnerUp.runner_up_reason}
              </div>
            </div>
          </>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full mt-5 py-3 rounded-xl text-[13px] font-semibold"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

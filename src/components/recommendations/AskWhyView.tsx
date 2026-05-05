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
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">How we matched this for you</p>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 underline"
        >
          Close
        </button>
      </div>

      {/* Filter summary — expanded */}
      <p className="text-sm text-gray-600 leading-relaxed mb-4">
        {rec.filter_summary}
      </p>

      {/* Why it fits — detailed */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">From that pool, here's why this ranked:</p>
        <ul className="space-y-3">
          {rec.why_it_fits.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Uncertainty — detailed */}
      {rec.uncertainty_flags.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">What we're not sure about:</p>
          <ul className="space-y-2">
            {rec.uncertainty_flags.map((flag, i) => (
              <li key={i} className="text-sm text-amber-700 leading-relaxed">— {flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Runner-up */}
      {runnerUp && runnerUp.runner_up_reason && (
        <div className="bg-gray-50 rounded-xl p-3 mt-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">The next-closest we considered:</p>
          <p className="text-sm font-medium text-gray-800">
            {runnerUp.job.title}{runnerUp.job.company_name ? ` at ${runnerUp.job.company_name}` : ''}
          </p>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            {runnerUp.runner_up_reason}
          </p>
        </div>
      )}
    </div>
  )
}

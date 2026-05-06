'use client'

import { useState } from 'react'
import RecommendationCard from './RecommendationCard'
import type { Recommendation, Job } from '@/types'

const PRIMARY_COUNT = 5

interface Props {
  recs: (Recommendation & { job: Job })[]
  candidateId: string
}

export default function RecommendationsFeed({ recs, candidateId }: Props) {
  const [showingMore, setShowingMore] = useState(false)

  const primaryRecs = recs.slice(0, PRIMARY_COUNT)
  const secondaryRecs = recs.slice(PRIMARY_COUNT)
  // Runner-up for AskWhy = the first match not shown in the primary batch
  const runnerUp = recs[PRIMARY_COUNT] ?? null

  return (
    <div className="flex flex-col gap-2.5">
      {primaryRecs.map(rec => (
        <RecommendationCard
          key={rec.rec_id}
          rec={rec}
          job={rec.job}
          runnerUp={runnerUp}
          candidateId={candidateId}
        />
      ))}

      {secondaryRecs.length > 0 && (
        <>
          {!showingMore ? (
            <button
              onClick={() => setShowingMore(true)}
              className="w-full py-3.5 rounded-2xl text-[13px] font-semibold text-center transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
              }}
            >
              {secondaryRecs.length} more matched your filters — ranked lower on fit ↓
            </button>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div
                className="px-1 pt-1 text-[11px] font-medium leading-relaxed"
                style={{ color: 'var(--text-3)' }}
              >
                These matched your filters but ranked lower — weaker signal on fit to your specific situation.
              </div>
              {secondaryRecs.map(rec => (
                <RecommendationCard
                  key={rec.rec_id}
                  rec={rec}
                  job={rec.job}
                  runnerUp={null}
                  candidateId={candidateId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

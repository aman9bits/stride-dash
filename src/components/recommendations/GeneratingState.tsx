'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  candidateId: string
}

export default function GeneratingState({ candidateId }: Props) {
  const router = useRouter()
  const [attempts, setAttempts] = useState(0)
  const [triggered, setTriggered] = useState(false)

  // Trigger matching run once if not already running
  useEffect(() => {
    if (triggered) return
    setTriggered(true)
    fetch('/api/matching/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: candidateId }),
    })
  }, [candidateId, triggered])

  // Poll every 5 seconds to check if recs are ready
  useEffect(() => {
    const interval = setInterval(() => {
      setAttempts(a => a + 1)
      router.refresh()
    }, 5000)
    return () => clearInterval(interval)
  }, [router])

  const dots = '.'.repeat((attempts % 3) + 1)

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto flex flex-col">
      <div className="px-4 pt-6 pb-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">Stride Dash</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-6">
          <div className="flex gap-1.5 justify-center">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2.5 h-2.5 bg-gray-900 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
        <p className="text-lg font-semibold text-gray-900 mb-2">
          Finding your matches{dots}
        </p>
        <p className="text-sm text-gray-500 leading-relaxed">
          We're reading through jobs and writing a specific reason why each one fits your situation. This takes about 30–60 seconds.
        </p>
        {attempts > 6 && (
          <p className="text-xs text-gray-400 mt-6">
            Taking longer than expected. Hang tight — good explanations take time.
          </p>
        )}
      </div>
    </div>
  )
}

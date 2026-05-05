'use client'

import { useState } from 'react'

const REASONS = [
  'Too early stage', 'Too big a company', 'Salary likely low',
  'Wrong domain', 'Location', 'Skills mismatch', 'Something else',
]

interface Props {
  onConfirm: (reason: string) => void
  onCancel: () => void
  isLoading: boolean
  alreadyDismissed?: boolean
}

export default function DismissChips({ onConfirm, onCancel, isLoading, alreadyDismissed }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  if (alreadyDismissed) {
    return (
      <div className="px-4 pb-4">
        <div className="text-[11px] font-medium pt-3 mb-2" style={{ color: 'var(--text-3)' }}>What was off?</div>
        <div className="flex flex-wrap gap-2">
          {REASONS.map(r => (
            <button key={r}
              className="text-[12px] font-medium rounded-full px-3 py-1.5 border"
              style={{ background: 'transparent', borderColor: 'var(--border-b)', color: 'var(--text-3)' }}
              disabled>
              {r}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4">
      <div className="text-[11px] font-medium pt-3 mb-2.5" style={{ color: 'var(--text-3)' }}>
        What was off? (helps us improve)
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {REASONS.map(r => {
          const active = selected === r
          return (
            <button key={r}
              onClick={() => setSelected(prev => prev === r ? null : r)}
              className="text-[12px] font-medium rounded-full px-3 py-1.5 border transition-all"
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                borderColor: active ? 'var(--accent)' : 'var(--border-b)',
                color: active ? 'var(--accent)' : 'var(--text-2)',
              }}>
              {r}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(selected ?? 'No reason given')}
          disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#060C1A' }}>
          {isLoading ? 'Dismissing…' : 'Confirm dismiss'}
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2.5 rounded-xl text-[13px] font-medium"
          style={{ border: '1px solid var(--border-b)', color: 'var(--text-2)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

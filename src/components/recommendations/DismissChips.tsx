'use client'

import { useState } from 'react'

const DISMISS_REASONS = [
  'Pay too low',
  'Company too big',
  'Wrong function',
  'Too senior / too junior',
  'Already know this company',
  'Location doesn\'t work',
]

interface Props {
  onConfirm: (reason: string) => void
  onCancel: () => void
  isLoading: boolean
}

export default function DismissChips({ onConfirm, onCancel, isLoading }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [other, setOther] = useState('')
  const [showOther, setShowOther] = useState(false)

  function handleChip(reason: string) {
    if (reason === 'Other') {
      setShowOther(true)
      setSelected(null)
    } else {
      setShowOther(false)
      setSelected(reason)
    }
  }

  function handleConfirm() {
    const reason = showOther ? other.trim() : selected
    if (!reason) return
    onConfirm(reason)
  }

  const canConfirm = showOther ? other.trim().length > 0 : selected !== null

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-3">What's off? (helps us improve)</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {DISMISS_REASONS.map(reason => (
          <button
            key={reason}
            onClick={() => handleChip(reason)}
            className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
              selected === reason
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-600 bg-white'
            }`}
          >
            {reason}
          </button>
        ))}
        <button
          onClick={() => handleChip('Other')}
          className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
            showOther
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 text-gray-600 bg-white'
          }`}
        >
          Other
        </button>
      </div>

      {showOther && (
        <input
          type="text"
          value={other}
          onChange={e => setOther(e.target.value)}
          placeholder="Tell us what's off..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:border-gray-400 bg-gray-50"
          autoFocus
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || isLoading}
          className="flex-1 bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 active:scale-95 transition-transform"
        >
          {isLoading ? 'Dismissing...' : 'Dismiss'}
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

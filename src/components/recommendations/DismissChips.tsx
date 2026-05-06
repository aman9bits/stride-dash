'use client'

const REASONS = [
  'Too early stage', 'Too big a company', 'Salary likely low',
  'Wrong domain', 'Location', 'Skills mismatch', 'Something else',
]

interface Props {
  onConfirm: (reason: string) => void
  isLoading: boolean
}

export default function DismissChips({ onConfirm, isLoading }: Props) {
  return (
    <div className="px-4 pb-4">
      <div className="text-[11px] font-medium pt-3 mb-2.5" style={{ color: 'var(--text-3)' }}>
        What was off?
      </div>
      <div className="flex flex-wrap gap-2">
        {REASONS.map(r => (
          <button
            key={r}
            onClick={() => !isLoading && onConfirm(r)}
            disabled={isLoading}
            className="text-[12px] font-medium rounded-full px-3 py-1.5 border transition-all disabled:opacity-40"
            style={{
              background: 'transparent',
              borderColor: 'var(--border-b)',
              color: 'var(--text-2)',
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

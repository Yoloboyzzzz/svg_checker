import { useState } from 'react'
import type { CheckResult } from '../types'

interface CheckCardProps {
  result: CheckResult
}

export function CheckCard({ result }: CheckCardProps) {
  const [open, setOpen] = useState(false)
  const passStyle = result.pass ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
  const badgeStyle = result.pass ? 'text-green-600' : 'text-red-600'

  return (
    <div className={`rounded-lg border ${passStyle}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="font-medium text-gray-800">{result.label}</span>
        <span className={`text-sm font-semibold ${badgeStyle}`}>
          {result.pass
            ? '✓ Pass'
            : `✗ ${result.violationCount} issue${result.violationCount !== 1 ? 's' : ''}`}
          <span className="ml-2 text-gray-400">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-200">
          {result.violations.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No issues found.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {result.violations.map((v, i) => (
                <li key={i} className="text-sm text-gray-600">
                  <code className="bg-gray-100 px-1 rounded">{v.elementId ?? `#${v.elementIndex}`}</code>
                  {' — '}{v.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

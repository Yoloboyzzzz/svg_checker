interface FixButtonProps {
  score: number
  onFix: () => void
}

export function FixButton({ score, onFix }: FixButtonProps) {
  return (
    <button
      onClick={onFix}
      disabled={score === 100}
      aria-disabled={score === 100}
      className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
    >
      {score === 100 ? 'No Issues to Fix' : 'Fix Issues & Download'}
    </button>
  )
}

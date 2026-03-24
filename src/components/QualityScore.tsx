interface QualityScoreProps {
  score: number
}

export function QualityScore({ score }: QualityScoreProps) {
  const color = score === 100 ? 'text-green-600' : score === 0 ? 'text-red-600' : 'text-amber-500'
  const bgColor = score === 100 ? 'bg-green-50 border-green-200' : score === 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
  const label = score === 100 ? 'Pass' : 'Issues found'
  return (
    <div className={`rounded-xl border-2 p-6 text-center ${bgColor}`}>
      <div className={`text-6xl font-bold ${color}`}>{score}%</div>
      <div className={`mt-1 text-sm font-medium ${color}`}>{label}</div>
    </div>
  )
}

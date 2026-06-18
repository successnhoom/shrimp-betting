interface Props {
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple'
  icon?: string
}

const colorMap = {
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  green:  'bg-green-50 text-green-700 border-green-100',
  amber:  'bg-amber-50 text-amber-700 border-amber-100',
  red:    'bg-red-50 text-red-700 border-red-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
}

export function StatCard({ label, value, sub, color = 'blue', icon }: Props) {
  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color]}`}>
      {icon && <div className="text-2xl mb-1">{icon}</div>}
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

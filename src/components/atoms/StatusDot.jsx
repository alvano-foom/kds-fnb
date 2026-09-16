const COLORS = {
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
  gray: 'bg-gray-400',
  red: 'bg-red-500',
}

export function StatusDot({ color = 'gray', className = '' }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${COLORS[color] ?? COLORS.gray} ${className}`} />
}

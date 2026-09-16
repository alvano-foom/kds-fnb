const TONES = {
  neutral: 'bg-gray-100 text-gray-600',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  accent: 'bg-brand-secondary/15 text-brand-secondary',
}

export function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}

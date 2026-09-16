const VARIANTS = {
  primary: 'bg-brand text-brand-contrast hover:opacity-90',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  ghost: 'bg-transparent text-brand-contrast/90 hover:bg-white/10',
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

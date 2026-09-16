export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}
      {...props}
    />
  )
}

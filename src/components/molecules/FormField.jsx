export function FormField({ label, error, htmlFor, children }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-sm text-red-600">{error}</span>}
    </label>
  )
}

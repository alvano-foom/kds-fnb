export function Select({ id, value, onChange, options, placeholder = 'Select...', disabled = false }) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-gray-50 disabled:text-gray-400"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.name}
        </option>
      ))}
    </select>
  )
}

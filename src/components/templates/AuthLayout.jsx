export function AuthLayout({ title, subtitle, logoUrl, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="mx-auto mb-3 h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-brand" />
          )}
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

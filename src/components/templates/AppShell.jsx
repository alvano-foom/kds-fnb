export function AppShell({ title, logoUrl, leftSlot, rightSlot, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <header className="flex items-center justify-between gap-4 bg-brand px-6 py-4 text-brand-contrast shadow">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />}
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {leftSlot}
        </div>
        <div className="flex shrink-0 items-center gap-3">{rightSlot}</div>
      </header>
      <main className="flex-1 overflow-hidden p-6">{children}</main>
    </div>
  )
}

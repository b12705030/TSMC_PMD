export function Loading({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className ?? ''}`}>
      {[80, 100, 64].map((w) => (
        <div key={w} className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 rounded bg-gray-200" style={{ width: `${w}%` }} />
              <div className="h-3 w-1/3 rounded bg-gray-100" />
            </div>
            <div className="ml-4 h-6 w-16 rounded-full bg-gray-100 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

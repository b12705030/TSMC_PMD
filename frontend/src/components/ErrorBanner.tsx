interface ErrorBannerProps {
  message: string
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>載入失敗：{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 rounded px-2 py-1 text-xs font-medium underline hover:no-underline"
        >
          重試
        </button>
      )}
    </div>
  )
}

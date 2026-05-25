const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 全域 401 事件：讓 AuthContext 監聽並清除 user
// reason: 'idle' | 'expired'
export function dispatchUnauthorized(reason: 'idle' | 'expired') {
  window.dispatchEvent(new CustomEvent('app:unauthorized', { detail: { reason } }))
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // send session cookie
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }))
    const msg = errorBody.message ?? res.statusText

    // 全域 401 處理：通知 AuthContext 登出
    if (res.status === 401) {
      const reason = typeof msg === 'string' && msg.toLowerCase().includes('idle')
        ? 'idle'
        : 'expired'
      dispatchUnauthorized(reason)
    }

    throw new ApiError(res.status, msg)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export { ApiError }

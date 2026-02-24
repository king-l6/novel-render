const BASE = ''

async function request<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : BASE + path
  const res = await fetch(url, { ...opts, credentials: 'include' })
  const text = await res.text()
  let data: T
  try {
    data = text ? (JSON.parse(text) as T) : (null as T)
  } catch {
    data = null as T
  }
  if (!res.ok) {
    const err = (data as { error?: string })?.error ?? res.statusText ?? '请求失败'
    throw new Error(err)
  }
  return data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: object) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: object) =>
    request<T>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
}

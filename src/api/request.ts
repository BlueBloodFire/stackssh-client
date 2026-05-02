/**
 * HTTP 请求客户端
 * 封装 fetch，统一处理响应格式和错误
 *
 * 开发模式：通过 Vite proxy 转发 /api → localhost:8091
 * 生产模式（Tauri）：直连 localhost:8091
 */

/** 后端统一响应结构 */
export interface ApiResponse<T = unknown> {
  code: string
  info: string
  data: T | null
}

/** 服务端基础地址 */
const BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8091'

/** 请求超时（毫秒） */
const TIMEOUT_MS = 15000

/**
 * 通用请求方法
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<ApiResponse<T>> {
  // 拼接 query string
  let url = `${BASE_URL}${path}`
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    if (qs) url += `?${qs}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      return { code: String(res.status), info: res.statusText, data: null }
    }

    return (await res.json()) as ApiResponse<T>
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { code: 'TIMEOUT', info: '请求超时', data: null }
    }
    return { code: 'NETWORK_ERROR', info: err?.message || '网络错误', data: null }
  } finally {
    clearTimeout(timer)
  }
}

/** GET 请求 */
export function get<T>(path: string, params?: Record<string, string>) {
  return request<T>('GET', path, undefined, params)
}

/** POST 请求（JSON body + 可选 query params） */
export function post<T>(path: string, body?: unknown, params?: Record<string, string>) {
  return request<T>('POST', path, body, params)
}

/** PUT 请求 */
export function put<T>(path: string, body?: unknown, params?: Record<string, string>) {
  return request<T>('PUT', path, body, params)
}

/** DELETE 请求 */
export function del<T>(path: string, params?: Record<string, string>) {
  return request<T>('DELETE', path, undefined, params)
}

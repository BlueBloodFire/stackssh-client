import { post } from './request'

export interface LoginData {
  token: string
  userId: string
  username: string
}

export function login(username: string, password: string) {
  return post<LoginData>('/api/v1/auth/login', { username, password })
}

export function register(username: string, password: string) {
  return post<void>('/api/v1/auth/register', { username, password })
}

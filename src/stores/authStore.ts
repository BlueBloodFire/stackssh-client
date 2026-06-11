import { create } from 'zustand'

const TOKEN_KEY = 'stackssh_token'
const USER_ID_KEY = 'stackssh_user_id'
const USERNAME_KEY = 'stackssh_username'

interface AuthState {
  token: string | null
  userId: string | null
  username: string | null
  isAuthenticated: boolean
  login: (token: string, userId: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  userId: localStorage.getItem(USER_ID_KEY),
  username: localStorage.getItem(USERNAME_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  login: (token, userId, username) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_ID_KEY, userId)
    localStorage.setItem(USERNAME_KEY, username)
    set({ token, userId, username, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_ID_KEY)
    localStorage.removeItem(USERNAME_KEY)
    set({ token: null, userId: null, username: null, isAuthenticated: false })
  },
}))

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

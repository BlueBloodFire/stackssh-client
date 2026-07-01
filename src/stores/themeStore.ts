import { create } from 'zustand'

export type ThemeName = 'dark' | 'light' | 'midnight'

export interface ThemeColors {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgInput: string
  bgHover: string
  bgTitleBar: string
  border: string
  text: string
  textSecondary: string
  textDim: string
  accent: string
  accentSoft: string
  green: string
  red: string
  yellow: string
}

export interface ThemeConfig {
  name: ThemeName
  label: string
  colors: ThemeColors
}

export const themes: Record<ThemeName, ThemeConfig> = {
  dark: {
    name: 'dark',
    label: '默认灰色',
    colors: {
      bgPrimary: '#12171d',
      bgSecondary: '#1a212b',
      bgTertiary: '#222b36',
      bgInput: '#151c24',
      bgHover: '#283241',
      bgTitleBar: '#141b24',
      border: '#313b49',
      text: '#edf2f7',
      textSecondary: '#b7c2cf',
      textDim: '#7f8b9c',
      accent: '#6aa4ff',
      accentSoft: 'rgba(106,164,255,0.14)',
      green: '#42c46f',
      red: '#ef6b73',
      yellow: '#f0b24d',
    },
  },
  light: {
    name: 'light',
    label: 'GitHub 白',
    colors: {
      bgPrimary: '#f6f8fa',
      bgSecondary: '#ffffff',
      bgTertiary: '#f6f8fa',
      bgInput: '#ffffff',
      bgHover: '#eef2f6',
      bgTitleBar: '#ffffff',
      border: '#d0d7de',
      text: '#1f2328',
      textSecondary: '#3d4753',
      textDim: '#6e7781',
      accent: '#0969da',
      accentSoft: 'rgba(9,105,218,0.10)',
      green: '#1f883d',
      red: '#cf222e',
      yellow: '#9a6700',
    },
  },
  midnight: {
    name: 'midnight',
    label: 'GitHub 黑',
    colors: {
      bgPrimary: '#0d1117',
      bgSecondary: '#161b22',
      bgTertiary: '#21262d',
      bgInput: '#0d1117',
      bgHover: '#1c2129',
      bgTitleBar: '#161b22',
      border: '#30363d',
      text: '#e6edf3',
      textSecondary: '#8b949e',
      textDim: '#484f58',
      accent: '#58a6ff',
      accentSoft: 'rgba(88,166,255,0.12)',
      green: '#3fb950',
      red: '#f85149',
      yellow: '#d29922',
    },
  },
}

const THEME_STORAGE_KEY = 'stackssh_theme'

function getInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && saved in themes) {
      return saved as ThemeName
    }
  } catch {
    // ignore localStorage failures
  }
  return 'dark'
}

interface ThemeStore {
  currentTheme: ThemeName
  colors: ThemeColors
  setTheme: (name: ThemeName) => void
}

const initialTheme = getInitialTheme()

export const useThemeStore = create<ThemeStore>((set) => ({
  currentTheme: initialTheme,
  colors: themes[initialTheme].colors,
  setTheme: (name) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, name)
    } catch {
      // ignore localStorage failures
    }
    set({
      currentTheme: name,
      colors: themes[name].colors,
    })
  },
}))

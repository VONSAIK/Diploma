import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import axios from 'axios'

interface AuthUser {
  user_id: number
  email: string
  access_token: string
}

interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      const parsed: AuthUser = JSON.parse(stored)
      setUser(parsed)
      axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.access_token}`
    }
    setIsLoading(false)
  }, [])

  const saveUser = (data: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(data))
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
    setUser(data)
  }

  const login = async (email: string, password: string) => {
    const res = await axios.post<AuthUser>('/api/auth/login', { email, password })
    saveUser(res.data)
  }

  const register = async (email: string, password: string) => {
    const res = await axios.post<AuthUser>('/api/auth/register', { email, password })
    saveUser(res.data)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

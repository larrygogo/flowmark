import { useCallback, useEffect, useState } from 'react'
import { getMe } from '../api/auth.ts'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('flowmark-token')
    if (!token) {
      setIsAuthenticated(false)
      return
    }
    try {
      await getMe()
      setIsAuthenticated(true)
    } catch {
      localStorage.removeItem('flowmark-token')
      setIsAuthenticated(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const setToken = useCallback((token: string) => {
    localStorage.setItem('flowmark-token', token)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('flowmark-token')
    setIsAuthenticated(false)
  }, [])

  return { isAuthenticated, setToken, logout, checkAuth }
}

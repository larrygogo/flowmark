import { useState } from 'react'
import { useNavigate } from 'react-router'
import { login, setup } from '../api/auth.ts'

export default function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [isSetup, setIsSetup] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (isSetup && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const fn = isSetup ? setup : login
      const { token } = await fn(password)
      onLogin(token)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg?.includes('Not set up')) {
        setIsSetup(true)
        setError('首次使用，请设置密码')
      } else {
        setError(msg || '登录失败')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">FlowMark</h1>
          <p className="mt-2 text-muted-foreground">
            {isSetup ? '设置你的密码' : '个人工作流管理'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />

          {isSetup && (
            <input
              type="password"
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {loading ? '...' : isSetup ? '设置密码并登录' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { login, setup } from '../api/client.ts'

export default function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [isSetup, setIsSetup] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await (isSetup ? setup : login)(password)
      onLogin(token)
    } catch (err: any) {
      const msg = err?.response?.data?.error
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
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">FlowMark</h1>
          <p className="mt-2 text-muted-foreground">{isSetup ? '设置密码' : '登录'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" placeholder="密码" value={password}
            onChange={(e) => setPassword(e.target.value)} autoFocus
            className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading || !password}
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
            {loading ? '...' : isSetup ? '设置密码' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

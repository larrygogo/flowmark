import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { Toaster } from 'sonner'
import { checkAuth } from './api/client.ts'
import Layout from './components/Layout.tsx'
import LoginPage from './pages/LoginPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ProjectListPage from './pages/ProjectListPage.tsx'
import ProjectDetailPage from './pages/ProjectDetailPage.tsx'
import DocsPage from './pages/DocsPage.tsx'
import DocDetailPage from './pages/DocDetailPage.tsx'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  const verify = useCallback(async () => {
    if (!localStorage.getItem('flowmark-token')) { setAuthed(false); return }
    try { await checkAuth(); setAuthed(true) }
    catch { localStorage.removeItem('flowmark-token'); setAuthed(false) }
  }, [])

  useEffect(() => { verify() }, [verify])

  const handleLogin = (token: string) => {
    localStorage.setItem('flowmark-token', token)
    setAuthed(true)
  }

  if (authed === null) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">加载中...</div>
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/login" element={authed ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
        <Route element={authed ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectListPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="docs/:id" element={<DocDetailPage />} />
          <Route path="projects/:pid/docs/:id" element={<DocDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

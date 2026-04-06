import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { Toaster } from 'sonner'
import { useAuth } from './hooks/useAuth.ts'
import Layout from './components/Layout.tsx'
import LoginPage from './pages/LoginPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ProjectListPage from './pages/ProjectListPage.tsx'
import NotesPage from './pages/NotesPage.tsx'
import ProjectDetailPage from './pages/ProjectDetailPage.tsx'

export default function App() {
  const { isAuthenticated, setToken, logout } = useAuth()

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onLogin={setToken} />
          }
        />
        <Route
          element={isAuthenticated ? <Layout onLogout={logout} /> : <Navigate to="/login" replace />}
        >
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectListPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="notes" element={<NotesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

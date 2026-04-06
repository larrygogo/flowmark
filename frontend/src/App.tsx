import { BrowserRouter, Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import Layout from './components/Layout.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ProjectListPage from './pages/ProjectListPage.tsx'
import ProjectDetailPage from './pages/ProjectDetailPage.tsx'
import NotesPage from './pages/NotesPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectListPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="notes" element={<NotesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

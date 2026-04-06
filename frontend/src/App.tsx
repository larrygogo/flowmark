import { BrowserRouter, Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import Layout from './components/Layout.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ProjectListPage from './pages/ProjectListPage.tsx'
import ProjectDetailPage from './pages/ProjectDetailPage.tsx'
import DocsPage from './pages/DocsPage.tsx'
import DocDetailPage from './pages/DocDetailPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectListPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="docs/:id" element={<DocDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

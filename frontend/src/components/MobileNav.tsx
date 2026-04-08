import { useLocation, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import { useSidebarStore } from '../stores/sidebar.ts'
import { listProjects } from '../api/projects.ts'
import type { Project } from '../types/index.ts'

export default function MobileNav() {
  const { setMobileOpen } = useSidebarStore()
  const location = useLocation()
  const params = useParams()
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  const title = getPageTitle(location.pathname, params, projects)

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-border px-3 glass md:hidden">
      <button
        onClick={() => setMobileOpen(true)}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu size={20} />
      </button>
      <span className="flex-1 truncate text-center text-sm font-medium">{title}</span>
      <div className="w-8" /> {/* 占位，保持标题居中 */}
    </header>
  )
}

function getPageTitle(pathname: string, params: Record<string, string | undefined>, projects: Project[]): string {
  if (pathname === '/') return '总览'
  if (pathname === '/docs') return '知识库'
  if (pathname === '/projects') return '项目'
  if (pathname.startsWith('/projects/') && params.id) {
    const project = projects.find(p => p.id === params.id)
    return project?.name ?? '项目详情'
  }
  if (pathname.startsWith('/docs/')) return '文档'
  return 'FlowMark'
}

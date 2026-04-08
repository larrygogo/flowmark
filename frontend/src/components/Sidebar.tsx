import { useEffect, useState } from 'react'
import { NavLink, useLocation, useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, FileText, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeft, Plus, BarChart3, LayoutList, Archive, Settings,
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { listProjects } from '../api/projects.ts'
import { useSidebarStore } from '../stores/sidebar.ts'
import { cn } from '../lib/utils.ts'
import type { Project } from '../types/index.ts'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '总览' },
  { to: '/docs', icon: FileText, label: '知识库' },
  { to: '/settings/api-keys', icon: Settings, label: '设置' },
]

export default function Sidebar() {
  const { collapsed, mobileOpen, expandedProjectId, toggle, setMobileOpen, setExpandedProject } = useSidebarStore()
  const location = useLocation()
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showArchived, setShowArchived] = useState(false)

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  const activeProjects = projects.filter((p: Project) => !p.archived)
  const archivedProjects = projects.filter((p: Project) => p.archived)

  // 自动展开当前项目
  const currentProjectId = params.id && location.pathname.startsWith('/projects/') ? params.id : null
  useEffect(() => {
    if (currentProjectId) setExpandedProject(currentProjectId)
  }, [currentProjectId, setExpandedProject])

  const currentView = searchParams.get('view') || 'overview'

  const handleProjectClick = (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProject(null)
    } else {
      setExpandedProject(projectId)
      navigate(`/projects/${projectId}`)
    }
    setMobileOpen(false)
  }

  const handleSubItemClick = (projectId: string, view: string) => {
    navigate(`/projects/${projectId}?view=${view}`)
    setMobileOpen(false)
  }

  const handleNavClick = () => {
    setMobileOpen(false)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className={cn('flex h-14 items-center border-b border-border', collapsed ? 'justify-center px-1' : 'px-3')}>
        {collapsed ? (
          <button
            onClick={toggle}
            className="hidden rounded-lg p-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors md:block"
          >
            <PanelLeft size={18} />
          </button>
        ) : (
          <>
            <div className="flex flex-1 items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                FM
              </div>
              <span className="truncate text-sm font-semibold">FlowMark</span>
            </div>
            <button
              onClick={toggle}
              className="hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors md:block"
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 overflow-y-auto py-2', collapsed ? 'px-1.5' : 'px-2')}>
        {/* 主导航 */}
        <div className={cn('space-y-0.5', collapsed && 'space-y-1')}>
          {navItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
          ))}
        </div>

        {/* 项目区域 */}
        <div className={cn('mt-3', collapsed && 'mt-2')}>
          {!collapsed && (
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                项目
              </span>
              <button
                onClick={() => { navigate('/projects'); setMobileOpen(false) }}
                className="rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                title="管理项目"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
          {collapsed && <div className="mx-auto my-1.5 h-px w-6 bg-border" />}

          <div className="space-y-0.5">
            {activeProjects.map((project: Project) => (
              <ProjectItem
                key={project.id}
                project={project}
                collapsed={collapsed}
                expanded={expandedProjectId === project.id}
                isActive={currentProjectId === project.id}
                currentView={currentView}
                onProjectClick={handleProjectClick}
                onSubItemClick={handleSubItemClick}
              />
            ))}
          </div>

          {/* 归档项目 */}
          {archivedProjects.length > 0 && !collapsed && (
            <div className="mt-2">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Archive size={12} />
                <span>归档项目 ({archivedProjects.length})</span>
                {showArchived ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {showArchived && (
                <div className="space-y-0.5 mt-0.5">
                  {archivedProjects.map((project: Project) => (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      collapsed={collapsed}
                      expanded={expandedProjectId === project.id}
                      isActive={currentProjectId === project.id}
                      currentView={currentView}
                      onProjectClick={handleProjectClick}
                      onSubItemClick={handleSubItemClick}
                      dimmed
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </div>
  )

  return (
    <Tooltip.Provider delayDuration={300}>
      {/* 桌面端侧边栏 */}
      <aside
        className={cn(
          'sidebar-glass fixed left-0 top-0 z-40 hidden h-dvh border-r border-border transition-[width] duration-200 md:block',
          collapsed ? 'w-14' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* 移动端覆盖层 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="sidebar-glass absolute left-0 top-0 h-full w-64 animate-sidebar-in border-r border-border">
            {sidebarContent}
          </aside>
        </div>
      )}
    </Tooltip.Provider>
  )
}

function SidebarNavLink({ to, icon: Icon, label, collapsed, onClick }: {
  to: string
  icon: React.ComponentType<{ size?: number }>
  label: string
  collapsed: boolean
  onClick: () => void
}) {
  const location = useLocation()
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const linkClass = cn(
    'flex w-full items-center rounded-lg text-sm transition-colors',
    isActive
      ? 'bg-accent text-foreground sidebar-active'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
    collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2.5 py-2'
  )

  const link = (
    <NavLink to={to} end={to === '/'} onClick={onClick} className={linkClass}>
      <Icon size={18} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
        <Tooltip.Content side="right" className="rounded-md bg-card px-2.5 py-1.5 text-xs text-foreground shadow-lg border border-border">
          {label}
        </Tooltip.Content>
      </Tooltip.Root>
    )
  }

  return link
}

const projectSubItems = [
  { view: 'overview', icon: BarChart3, label: '概览' },
  { view: 'board', icon: LayoutList, label: '看板' },
  { view: 'docs', icon: FileText, label: '文件' },
]

function ProjectItem({ project, collapsed, expanded, isActive, currentView, onProjectClick, onSubItemClick, dimmed }: {
  project: Project
  collapsed: boolean
  expanded: boolean
  isActive: boolean
  currentView: string
  onProjectClick: (id: string) => void
  onSubItemClick: (id: string, view: string) => void
  dimmed?: boolean
}) {
  const item = (
    <div>
      <button
        onClick={() => onProjectClick(project.id)}
        className={cn(
          'flex w-full items-center rounded-lg text-sm transition-colors',
          isActive && !expanded
            ? 'bg-accent text-foreground sidebar-active'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2.5 py-2',
          dimmed && 'opacity-50'
        )}
      >
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{project.name}</span>
            {isActive ? <ChevronDown size={14} /> : <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />}
          </>
        )}
      </button>

      {/* 子项 */}
      {expanded && !collapsed && (
        <div className="ml-5 space-y-0.5 py-0.5">
          {projectSubItems.map((sub) => (
            <button
              key={sub.view}
              onClick={() => onSubItemClick(project.id, sub.view)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                isActive && currentView === sub.view
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <sub.icon size={14} />
              <span>{sub.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  if (collapsed) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{item}</Tooltip.Trigger>
        <Tooltip.Content side="right" className="rounded-md bg-card px-2.5 py-1.5 text-xs text-foreground shadow-lg border border-border">
          {project.name}
        </Tooltip.Content>
      </Tooltip.Root>
    )
  }

  return item
}

import { NavLink, Outlet } from 'react-router'
import { LayoutDashboard, FolderKanban, StickyNote } from 'lucide-react'
import { cn } from '../lib/utils.ts'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '总览' },
  { to: '/projects', icon: FolderKanban, label: '项目' },
  { to: '/notes', icon: StickyNote, label: '记录' },
]

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top header — desktop */}
      <header className="hidden border-b border-border px-6 py-3 md:flex md:items-center md:justify-between">
        <h1 className="text-lg font-bold text-primary">FlowMark</h1>
        <nav className="flex items-center gap-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 text-sm transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom nav — mobile */}
      <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

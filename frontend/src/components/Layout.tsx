import { Outlet } from 'react-router'
import Sidebar from './Sidebar.tsx'
import MobileNav from './MobileNav.tsx'
import { useSidebarStore } from '../stores/sidebar.ts'
import { cn } from '../lib/utils.ts'

export default function Layout() {
  const collapsed = useSidebarStore((s) => s.collapsed)

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <main
        className={cn(
          'min-h-dvh transition-[margin] duration-200',
          collapsed ? 'md:ml-14' : 'md:ml-64'
        )}
      >
        <MobileNav />
        <Outlet />
      </main>
    </div>
  )
}

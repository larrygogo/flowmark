import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FolderKanban, GitBranch, Archive } from 'lucide-react'
import { listProjects } from '../api/projects.ts'
import { cn } from '../lib/utils.ts'

export default function ProjectListPage() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const [activeGroup, setActiveGroup] = useState('')
  const navigate = useNavigate()

  if (isLoading) return <div className="p-4 text-muted-foreground">加载中...</div>

  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)
  const groups = [...new Set(active.map(p => p.group_name || '未分类'))]
  const filtered = activeGroup ? active.filter(p => p.group_name === activeGroup) : active

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="text-xl font-bold">项目</h1>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setActiveGroup('')}
          className={cn('shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
            !activeGroup ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border')}>
          全部 ({active.length})
        </button>
        {groups.map(g => (
          <button key={g} onClick={() => setActiveGroup(activeGroup === g ? '' : g)}
            className={cn('shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
              activeGroup === g ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border')}>
            {g} ({active.filter(p => p.group_name === g).length})
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left active:bg-accent hover:bg-accent/50 transition-colors">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: p.color + '20', color: p.color }}>
              <FolderKanban size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.name}</div>
              {p.description && <div className="truncate text-sm text-muted-foreground">{p.description}</div>}
            </div>
            {p.github_url && <GitBranch size={16} className="shrink-0 text-muted-foreground" />}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <FolderKanban size={48} className="mx-auto mb-3 opacity-20" />
          <p>暂无项目</p>
        </div>
      )}

      {archived.length > 0 && !activeGroup && (
        <div className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Archive size={14} /> 已归档
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {archived.map((p) => (
              <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3 text-left opacity-60">
                <FolderKanban size={16} className="text-muted-foreground" />
                <span className="truncate text-sm text-muted-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

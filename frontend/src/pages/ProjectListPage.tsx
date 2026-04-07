import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FolderKanban, GitBranch, Archive } from 'lucide-react'
import { listProjects } from '../api/projects.ts'

export default function ProjectListPage() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const navigate = useNavigate()

  if (isLoading) return <div className="p-4 text-muted-foreground">加载中...</div>

  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)

  // Group by group_name
  const groups = new Map<string, typeof active>()
  for (const p of active) {
    const group = p.group_name || '未分类'
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(p)
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold">项目</h1>

      {[...groups.entries()].map(([groupName, items]) => (
        <div key={groupName} className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{groupName}</h2>
          <div className="space-y-2">
            {items.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left active:bg-accent transition-colors"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: p.color + '20', color: p.color }}
                >
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
        </div>
      ))}

      {active.length === 0 && (
        <div className="mt-8 py-12 text-center text-muted-foreground">
          <FolderKanban size={48} className="mx-auto mb-3 opacity-20" />
          <p>还没有项目</p>
          <p className="text-sm mt-1">通过 AI 对话创建</p>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Archive size={14} /> 已归档
          </h2>
          <div className="space-y-2">
            {archived.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/50 p-3 text-left opacity-60"
              >
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

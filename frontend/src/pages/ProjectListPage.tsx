import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, FolderKanban, GitBranch, Archive } from 'lucide-react'
import { useProjects, useCreateProject } from '../hooks/useProjects.ts'

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const createMutation = useCreateProject()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGithub, setNewGithub] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const project = await createMutation.mutateAsync({
      name: newName.trim(),
      github_url: newGithub.trim() || undefined,
    })
    setNewName('')
    setNewGithub('')
    setShowCreate(false)
    navigate(`/projects/${project.id}`)
  }

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">加载中...</div>
  }

  const activeProjects = projects?.filter((p) => !p.archived) ?? []
  const archivedProjects = projects?.filter((p) => p.archived) ?? []

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">项目</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} />
          新建
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4">
          <input
            type="text"
            placeholder="项目名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <input
            type="text"
            placeholder="GitHub URL（可选）"
            value={newGithub}
            onChange={(e) => setNewGithub(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newName.trim() || createMutation.isPending}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {activeProjects.map((project) => (
          <button
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors active:bg-accent"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: project.color + '20', color: project.color }}
            >
              <FolderKanban size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">{project.name}</div>
              {project.description && (
                <div className="truncate text-sm text-muted-foreground">{project.description}</div>
              )}
            </div>
            {project.github_url && (
              <GitBranch size={16} className="shrink-0 text-muted-foreground" />
            )}
          </button>
        ))}

        {activeProjects.length === 0 && !showCreate && (
          <div className="py-12 text-center text-muted-foreground">
            <FolderKanban size={48} className="mx-auto mb-3 opacity-30" />
            <p>还没有项目</p>
            <p className="text-sm">点击「新建」创建你的第一个项目</p>
          </div>
        )}
      </div>

      {archivedProjects.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Archive size={14} />
            已归档
          </h2>
          <div className="space-y-2">
            {archivedProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/50 p-3 text-left opacity-60"
              >
                <FolderKanban size={16} className="text-muted-foreground" />
                <span className="truncate text-sm text-muted-foreground">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

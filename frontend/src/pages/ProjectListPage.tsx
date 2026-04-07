import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FolderKanban, GitBranch, Archive, Plus, Pencil, Trash2, X, Search, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { listProjects, createProject, updateProject, deleteProject } from '../api/projects.ts'
import { parseTags } from '../lib/utils.ts'
import type { Project } from '../types/index.ts'

export default function ProjectListPage() {
  const qc = useQueryClient()
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const navigate = useNavigate()

  const createMutation = useMutation({ mutationFn: createProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowForm(false) } })
  const updateMutation = useMutation({
    mutationFn: ({ id, ...req }: { id: string } & Parameters<typeof updateProject>[1]) => updateProject(id, req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setEditingProject(null) },
  })
  const deleteMutation = useMutation({ mutationFn: deleteProject, onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }) })
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  if (isLoading) return <div className="p-4 text-muted-foreground">加载中...</div>

  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)
  const groups = [...new Set(active.map(p => p.group_name || '未分类'))]
  const allTags = [...new Set(active.flatMap(p => parseTags(p.tags)))]
  const filtered = active.filter(p => {
    if (activeGroup && p.group_name !== activeGroup) return false
    if (activeTag && !parseTags(p.tags).includes(activeTag)) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // 按 group_name 分组
  const groupedProjects = filtered.reduce<Record<string, Project[]>>((acc, p) => {
    const g = p.group_name || '未分类'
    ;(acc[g] ??= []).push(p)
    return acc
  }, {})
  const sortedGroupNames = Object.keys(groupedProjects).sort((a, b) => {
    if (a === '未分类') return 1
    if (b === '未分类') return -1
    return a.localeCompare(b, 'zh')
  })

  const toggleGroup = (g: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">项目</h1>
        <button onClick={() => { setShowForm(true); setEditingProject(null) }}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          <Plus size={16} /> 新建
        </button>
      </div>

      {/* Filters */}
      <div className="mt-3 flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..."
            className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={activeGroup} onChange={(e) => setActiveGroup(e.target.value)}
          className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">全部分类 ({active.length})</option>
          {groups.map(g => <option key={g} value={g}>{g} ({active.filter(p => p.group_name === g).length})</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={activeTag} onChange={(e) => setActiveTag(e.target.value)}
            className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">全部标签</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Create / Edit form */}
      {(showForm || editingProject) && (
        <ProjectForm
          project={editingProject}
          existingGroups={groups}
          onSubmit={(data) => {
            if (editingProject) {
              updateMutation.mutate({ id: editingProject.id, ...data })
            } else {
              createMutation.mutate(data)
            }
          }}
          onCancel={() => { setShowForm(false); setEditingProject(null) }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Grouped project list */}
      <div className="mt-4 space-y-4">
        {sortedGroupNames.map(groupName => {
          const groupProjects = groupedProjects[groupName]
          const isCollapsed = collapsedGroups.has(groupName)
          const isSingleGroup = sortedGroupNames.length === 1

          return (
            <div key={groupName}>
              {!isSingleGroup && (
                <button onClick={() => toggleGroup(groupName)}
                  className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <Layers size={14} />
                  <span>{groupName}</span>
                  <span className="text-xs font-normal">({groupProjects.length})</span>
                </button>
              )}
              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupProjects.map((p) => (
                    <div key={p.id} className="group rounded-lg border border-border bg-card p-4 active:bg-accent hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <button onClick={() => navigate(`/projects/${p.id}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: p.color + '20', color: p.color }}>
                            <FolderKanban size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 truncate font-medium">
                              {p.github_url && <GitBranch size={14} className="shrink-0 text-muted-foreground" />}
                              <span className="truncate">{p.name}</span>
                            </div>
                            {p.description && <div className="truncate text-sm text-muted-foreground">{p.description}</div>}
                            {parseTags(p.tags).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {parseTags(p.tags).map(t => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}
                              </div>
                            )}
                          </div>
                        </button>
                        <div className="flex shrink-0 gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingProject(p)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                          <button onClick={() => { if (confirm(`删除项目「${p.name}」？`)) deleteMutation.mutate(p.id) }}
                            className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && !showForm && (
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
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3 opacity-60">
                <button onClick={() => navigate(`/projects/${p.id}`)} className="flex-1 text-left">
                  <span className="truncate text-sm text-muted-foreground">{p.name}</span>
                </button>
                <button onClick={() => updateMutation.mutate({ id: p.id, archived: false })}
                  className="text-xs text-primary">恢复</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectForm({ project, onSubmit, onCancel, loading, existingGroups }: {
  project: Project | null
  onSubmit: (data: { name: string; description?: string; github_url?: string; color?: string; group_name?: string; tags?: string[] }) => void
  onCancel: () => void
  loading: boolean
  existingGroups: string[]
}) {
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [githubUrl, setGithubUrl] = useState(project?.github_url || '')
  const [color, setColor] = useState(project?.color || '#6366f1')
  const [groupName, setGroupName] = useState(project?.group_name || '个人项目')
  const [tagsText, setTagsText] = useState(() => parseTags(project?.tags).join(', '))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const tags = tagsText.split(',').map(s => s.trim()).filter(Boolean)
    onSubmit({ name: name.trim(), description: description.trim() || undefined, github_url: githubUrl.trim() || undefined, color, group_name: groupName, tags: tags.length > 0 ? tags : undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{project ? '编辑项目' : '新建项目'}</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground"><X size={18} /></button>
      </div>
      <input type="text" placeholder="项目名称" value={name} onChange={(e) => setName(e.target.value)} autoFocus
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <input type="text" placeholder="描述（可选）" value={description} onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <input type="text" placeholder="GitHub URL（可选）" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <input type="text" placeholder="标签（逗号分隔）" value={tagsText} onChange={(e) => setTagsText(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input type="text" list="group-options" placeholder="分组名称" value={groupName} onChange={(e) => setGroupName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <datalist id="group-options">
            {existingGroups.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="h-9 w-9 rounded-md border border-input bg-background p-0.5" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || loading}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {loading ? '...' : project ? '保存' : '创建'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">取消</button>
      </div>
    </form>
  )
}

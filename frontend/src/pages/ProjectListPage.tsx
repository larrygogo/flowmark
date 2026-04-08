import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FolderKanban, GitBranch, Archive, Plus, Pencil, Trash2, Search, ChevronRight } from 'lucide-react'
import { listProjects, createProject, updateProject, deleteProject } from '../api/projects.ts'
import Drawer from '../components/Drawer.tsx'
import { parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { Project } from '../types/index.ts'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

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

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="flex items-center justify-between">
        <button onClick={() => { setShowForm(true); setEditingProject(null) }}
          className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground ml-auto">
          <Plus size={16} /> 新建
        </button>
      </div>

      {/* Search */}
      <div className="mt-3 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..."
          className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Filter pills */}
      {(groups.length > 1 || allTags.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {groups.length > 1 && groups.map(g => (
            <button key={g} onClick={() => setActiveGroup(activeGroup === g ? '' : g)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${activeGroup === g ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {g}
            </button>
          ))}
          {allTags.length > 0 && groups.length > 1 && <div className="w-px h-5 bg-border self-center mx-0.5" />}
          {allTags.map(t => (
            <button key={t} onClick={() => setActiveTag(activeTag === t ? '' : t)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${activeTag === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Create / Edit drawer */}
      <Drawer
        open={showForm || !!editingProject}
        onClose={() => { setShowForm(false); setEditingProject(null) }}
        title={editingProject ? '编辑项目' : '新建项目'}
      >
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
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Drawer>

      {/* Project list — sorted by last_activity_at from backend */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <div key={p.id} className="group rounded-xl border border-border bg-card p-4 active:bg-accent hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(`/projects/${p.id}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: p.color + '20', color: p.color }}>
                  <FolderKanban size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate font-medium">
                    {p.github_url && <GitBranch size={14} className="shrink-0 text-muted-foreground" />}
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {p.group_name && p.group_name !== '个人项目' && (
                      <span className="rounded-full bg-muted px-2 py-0.5">{p.group_name}</span>
                    )}
                    {parseTags(p.tags).map(t => <span key={t} className="rounded-full bg-muted px-2 py-0.5">{t}</span>)}
                    <span>{dayjs(p.last_activity_at || p.updated_at).fromNow()}</span>
                  </div>
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
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 opacity-60">
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

function ProjectForm({ project, onSubmit, loading, existingGroups }: {
  project: Project | null
  onSubmit: (data: { name: string; description?: string; github_url?: string; color?: string; group_name?: string; tags?: string[] }) => void
  loading: boolean
  existingGroups: string[]
}) {
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [githubUrl, setGithubUrl] = useState(project?.github_url || '')
  const [color, setColor] = useState(project?.color || '#6366f1')
  const [groupName, setGroupName] = useState(project?.group_name || '个人项目')
  const [tags, setTags] = useState<string[]>(() => parseTags(project?.tags))
  const [showGroupSheet, setShowGroupSheet] = useState(false)
  const [showTagSheet, setShowTagSheet] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const [newTag, setNewTag] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), description: description.trim() || undefined, github_url: githubUrl.trim() || undefined, color, group_name: groupName, tags: tags.length > 0 ? tags : undefined })
  }

  const inputClass = 'w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="text" placeholder="项目名称" value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inputClass} />
      <input type="text" placeholder="描述（可选）" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      <input type="text" placeholder="GitHub URL（可选）" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className={inputClass} />

      {/* Group selector */}
      <div>
        <button type="button" onClick={() => setShowGroupSheet(!showGroupSheet)}
          className="w-full flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
          <span className={groupName ? 'text-foreground' : 'text-muted-foreground'}>{groupName || '选择分组'}</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        {showGroupSheet && (
          <div className="mt-2 rounded-xl border border-border bg-background p-3 space-y-1">
            {existingGroups.map(g => (
              <button key={g} type="button" onClick={() => { setGroupName(g); setShowGroupSheet(false) }}
                className={`w-full text-left rounded-xl px-3 py-2 text-sm transition-colors ${g === groupName ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                {g}
              </button>
            ))}
            <div className="flex gap-2 mt-2 pt-2 border-t border-border">
              <input type="text" placeholder="新分组..." value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => { if (newGroup.trim()) { setGroupName(newGroup.trim()); setNewGroup(''); setShowGroupSheet(false) } }}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">添加</button>
            </div>
          </div>
        )}
      </div>

      {/* Tags selector */}
      <div>
        <button type="button" onClick={() => setShowTagSheet(!showTagSheet)}
          className="w-full flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
          <span className={tags.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
            {tags.length > 0 ? tags.join(', ') : '选择标签'}
          </span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        {showTagSheet && (
          <div className="mt-2 rounded-xl border border-border bg-background p-3 space-y-1">
            {/* Show all known tags from existing groups + current tags */}
            {[...new Set([...existingGroups.flatMap(() => []), ...tags])].length === 0 && tags.length === 0 && (
              <div className="text-xs text-muted-foreground px-3 py-1">暂无标签</div>
            )}
            {tags.map(t => (
              <button key={t} type="button" onClick={() => setTags(tags.filter(x => x !== t))}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm mr-1 mb-1">
                {t} <span className="text-xs">×</span>
              </button>
            ))}
            <div className="flex gap-2 mt-2 pt-2 border-t border-border">
              <input type="text" placeholder="新标签..." value={newTag} onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newTag.trim() && !tags.includes(newTag.trim())) { setTags([...tags, newTag.trim()]); setNewTag('') } } }}
                className="flex-1 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => { if (newTag.trim() && !tags.includes(newTag.trim())) { setTags([...tags, newTag.trim()]); setNewTag('') } }}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">添加</button>
            </div>
          </div>
        )}
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">项目颜色</span>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="h-9 w-9 rounded-xl border border-border bg-background p-0.5" />
      </div>

      {/* Submit */}
      <button type="submit" disabled={!name.trim() || loading}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {loading ? '...' : project ? '保存' : '创建项目'}
      </button>
    </form>
  )
}

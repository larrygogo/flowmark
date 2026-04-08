import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, GitBranch, AlertTriangle, Search, FileText, Plus, BarChart3, CheckCircle2, Circle, Clock, Pencil } from 'lucide-react'
import { getProject, listTasks, listDocuments, createTask, updateProject, type ProjectDetail, type BoardWithColumns } from '../api/projects.ts'
import Drawer from '../components/Drawer.tsx'
import TaskDetailDrawer from '../components/TaskDetailDrawer.tsx'
import ProjectFiles from '../components/ProjectFiles.tsx'
import { cn, parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { Task, Column, Document } from '../types/index.ts'

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-gray-400', none: 'bg-transparent',
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id!), enabled: !!id })
  const viewTab = (searchParams.get('view') || 'overview') as 'overview' | 'board' | 'docs'
  const [boardIdx, setBoardIdx] = useState(0)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskPriority, setTaskPriority] = useState('')
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editGithub, setEditGithub] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const qc = useQueryClient()

  const board = project?.boards?.[boardIdx]
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', board?.id], queryFn: () => listTasks({ board_id: board!.id }), enabled: !!board })
  const { data: docsData } = useQuery({
    queryKey: ['project-docs', id],
    queryFn: () => listDocuments({ project_id: id!, page_size: 100 }),
    enabled: !!id,
  })
  const docs = docsData?.items ?? []

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', board?.id] }),
  })
  const updateProjectMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProject>[1]) => updateProject(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); setShowEditDrawer(false) },
  })

  if (isLoading || !project) return <div className="p-4 text-muted-foreground">加载中...</div>

  const openEditDrawer = () => {
    setEditName(project.name)
    setEditDesc(project.description)
    setEditGithub(project.github_url || '')
    setEditColor(project.color)
    setEditGroup(project.group_name)
    setEditTags(parseTags(project.tags))
    setNewTagInput('')
    setShowEditDrawer(true)
  }

  const boards = project.boards ?? []

  const filteredTasks = tasks.filter(t => {
    if (t.parent_task_id) return false
    if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase())) return false
    if (taskPriority && t.priority !== taskPriority) return false
    return true
  })

  const tasksByCol = new Map<string, Task[]>()
  for (const col of board?.columns ?? []) tasksByCol.set(col.id, [])
  for (const t of filteredTasks) {
    tasksByCol.get(t.column_id)?.push(t)
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <h1 className="min-w-0 flex-1 truncate font-bold">{project.name}</h1>
        {(project.group_name || parseTags(project.tags).length > 0) && (
          <div className="hidden md:flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {project.group_name && <span className="rounded-full bg-muted px-2 py-0.5">{project.group_name}</span>}
            {parseTags(project.tags).map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5">{t}</span>)}
          </div>
        )}
        {viewTab === 'board' && boards.length > 1 && (
          <div className="hidden md:flex items-center gap-1">
            {boards.map((b, i) => (
              <button key={b.id} onClick={() => setBoardIdx(i)}
                className={cn('shrink-0 rounded-md px-2 py-1 text-xs', i === boardIdx ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
                {b.name}
              </button>
            ))}
          </div>
        )}
        <button onClick={openEditDrawer} className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="编辑项目">
          <Pencil size={18} />
        </button>
      </div>

      {/* Overview */}
      {viewTab === 'overview' && (
        <ProjectOverview project={project} tasks={tasks} docs={docs} boards={boards} navigate={navigate} id={id!} />
      )}

      {/* Board view */}
      {viewTab === 'board' && (
        <>
          {board && tasks.length > 0 && (
            <div className="flex gap-2 items-center px-4 pt-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="搜索任务..." className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}
                className="shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">优先级</option>
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          )}

          {board && (
            <div className="flex gap-3 overflow-x-auto p-4 snap-x snap-mandatory md:snap-none">
              {board.columns.map((col: Column) => {
                const colTasks = tasksByCol.get(col.id) ?? []
                return (
                  <div key={col.id} className="w-72 shrink-0 snap-center rounded-xl border border-border bg-card md:w-64">
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="flex-1 text-sm font-medium">{col.name}</span>
                      <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                      <button onClick={() => { setAddingInColumn(col.id); setNewTaskTitle('') }} className="text-muted-foreground hover:text-foreground"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-2 p-2 min-h-[80px]">
                      {addingInColumn === col.id && (
                        <form onSubmit={(e) => { e.preventDefault(); if (newTaskTitle.trim()) { createTaskMutation.mutate({ column_id: col.id, title: newTaskTitle.trim() }); setNewTaskTitle(''); setAddingInColumn(null) } }}>
                          <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="任务标题"
                            autoFocus onBlur={() => { if (!newTaskTitle.trim()) setAddingInColumn(null) }}
                            onKeyDown={(e) => { if (e.key === 'Escape') setAddingInColumn(null) }}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        </form>
                      )}
                      {colTasks.map((task) => <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task)} />)}
                      {colTasks.length === 0 && addingInColumn !== col.id && (
                        <div className="flex items-center justify-center h-16 text-xs text-muted-foreground opacity-40">空</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Files view */}
      {viewTab === 'docs' && (
        <ProjectFiles projectId={id!} />
      )}

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          boardId={board?.id}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Edit project drawer */}
      <Drawer open={showEditDrawer} onClose={() => setShowEditDrawer(false)} title="编辑项目">
        <form onSubmit={(e) => { e.preventDefault(); updateProjectMutation.mutate({ name: editName.trim(), description: editDesc.trim(), github_url: editGithub.trim() || undefined, color: editColor, group_name: editGroup, tags: editTags }) }} className="space-y-4">
          <input type="text" placeholder="项目名称" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
            className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="text" placeholder="描述（可选）" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="text" placeholder="GitHub URL（可选）" value={editGithub} onChange={(e) => setEditGithub(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="text" placeholder="分组" value={editGroup} onChange={(e) => setEditGroup(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {/* 标签 */}
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {editTags.map(t => (
                <button key={t} type="button" onClick={() => setEditTags(editTags.filter(x => x !== t))}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs">
                  {t} <span>×</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="添加标签..." value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newTagInput.trim() && !editTags.includes(newTagInput.trim())) { setEditTags([...editTags, newTagInput.trim()]); setNewTagInput('') } } }}
                className="flex-1 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => { if (newTagInput.trim() && !editTags.includes(newTagInput.trim())) { setEditTags([...editTags, newTagInput.trim()]); setNewTagInput('') } }}
                className="shrink-0 rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">添加</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">项目颜色</span>
            <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)}
              className="h-9 w-9 rounded-xl border border-border bg-background p-0.5" />
          </div>
          <button type="submit" disabled={!editName.trim() || updateProjectMutation.isPending}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {updateProjectMutation.isPending ? '...' : '保存'}
          </button>
        </form>
      </Drawer>
    </div>
  )
}

function ProjectOverview({ project, tasks, docs, boards, navigate, id }: {
  project: ProjectDetail
  tasks: Task[]
  docs: (Document & { project_name?: string })[]
  boards: BoardWithColumns[]
  navigate: (path: string) => void
  id: string
}) {
  // Compute task stats across all boards
  const rootTasks = tasks.filter(t => !t.parent_task_id)
  const totalTasks = rootTasks.length

  // Categorize by column name
  const doneColIds = new Set<string>()
  const progressColIds = new Set<string>()
  for (const b of boards) {
    for (const col of b.columns) {
      const n = col.name.toLowerCase()
      if (n.includes('done') || n.includes('完成')) doneColIds.add(col.id)
      else if (n.includes('progress') || n.includes('doing') || n.includes('进行')) progressColIds.add(col.id)
    }
  }
  const doneTasks = rootTasks.filter(t => doneColIds.has(t.column_id)).length
  const inProgressTasks = rootTasks.filter(t => progressColIds.has(t.column_id)).length
  const todoTasks = totalTasks - doneTasks - inProgressTasks
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const overdueTasks = rootTasks.filter(t => isOverdue(t.due_date) && !doneColIds.has(t.column_id))
  const recentDocs = docs.slice(0, 5)

  // High priority tasks not done
  const urgentTasks = rootTasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && !doneColIds.has(t.column_id))

  return (
    <div className="p-4 space-y-4">
      {/* Description & repo */}
      {(project.description || project.github_url) && (
        <div className="space-y-1.5">
          {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
          {project.github_url && (
            <a href={project.github_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <GitBranch size={14} />
              <span>{project.github_owner}/{project.github_repo}</span>
            </a>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Circle size={12} /> 待办</div>
          <div className="mt-1 text-2xl font-bold">{todoTasks}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock size={12} /> 进行中</div>
          <div className="mt-1 text-2xl font-bold">{inProgressTasks}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={12} /> 已完成</div>
          <div className="mt-1 text-2xl font-bold">{doneTasks}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText size={12} /> 文档</div>
          <div className="mt-1 text-2xl font-bold">{docs.length}</div>
        </div>
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">整体进度</span>
            <span className="text-muted-foreground">{completionPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      )}

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
            <AlertTriangle size={14} /> 逾期任务 ({overdueTasks.length})
          </div>
          <div className="space-y-1.5">
            {overdueTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <div className={cn('h-2 w-2 shrink-0 rounded-full', priorityColors[t.priority])} />
                <span className="flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-destructive">{t.due_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent/high priority tasks */}
      {urgentTasks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-medium mb-2">高优先级任务</div>
          <div className="space-y-1.5">
            {urgentTasks.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <div className={cn('h-2 w-2 shrink-0 rounded-full', priorityColors[t.priority])} />
                <span className="flex-1 truncate">{t.title}</span>
                {t.due_date && <span className="shrink-0 text-xs text-muted-foreground">{t.due_date}</span>}
              </div>
            ))}
            {urgentTasks.length > 5 && <div className="text-xs text-muted-foreground">还有 {urgentTasks.length - 5} 个...</div>}
          </div>
        </div>
      )}

      {/* Recent docs */}
      {recentDocs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-medium mb-2">最近文档</div>
          <div className="space-y-1.5">
            {recentDocs.map(doc => (
              <button key={doc.id} onClick={() => navigate(`/docs/${doc.id}?from=project&pid=${id}`)}
                className="flex items-center gap-2 text-sm w-full text-left hover:text-primary transition-colors">
                <FileText size={13} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{doc.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{dayjs(doc.updated_at).format('MM-DD')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalTasks === 0 && docs.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-20" />
          <p>项目还没有任务和文档</p>
        </div>
      )}
    </div>
  )
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toISOString().split('T')[0])
}

function TaskItem({ task, onClick }: { task: Task; onClick?: () => void }) {
  const labels: string[] = (() => { try { return typeof task.labels === 'string' ? JSON.parse(task.labels) : task.labels } catch { return [] } })()

  return (
    <div onClick={onClick} className={cn('rounded-xl border bg-background p-3 cursor-pointer hover:bg-accent/30 transition-colors', isOverdue(task.due_date) ? 'border-destructive/40' : 'border-border')}>
      <div className="flex items-start gap-2">
        {task.priority !== 'none' && <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', priorityColors[task.priority])} />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug">{task.title}</div>
          {labels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {labels.map((l) => <span key={l} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{l}</span>)}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            {task.progress > 0 && (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-12 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${task.progress}%` }} />
                </div>
                <span>{task.progress}%</span>
              </div>
            )}
            {task.due_date && (
              <div className={cn('flex items-center gap-1', isOverdue(task.due_date) && 'text-destructive')}>
                {isOverdue(task.due_date) ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                {task.due_date}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

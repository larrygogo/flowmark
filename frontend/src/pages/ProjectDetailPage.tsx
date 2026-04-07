import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, GitBranch, AlertTriangle, Search, LayoutList, FileText, Plus } from 'lucide-react'
import { getProject, listTasks, listDocuments, createTask } from '../api/projects.ts'
import { cn, parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { Task, Column, Document } from '../types/index.ts'

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-gray-400', none: 'bg-transparent',
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id!), enabled: !!id })
  const [viewTab, setViewTab] = useState<'board' | 'docs'>('board')
  const [boardIdx, setBoardIdx] = useState(0)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskPriority, setTaskPriority] = useState('')
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const qc = useQueryClient()

  const board = project?.boards?.[boardIdx]
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', board?.id], queryFn: () => listTasks({ board_id: board!.id }), enabled: !!board })
  const { data: docs = [] } = useQuery({
    queryKey: ['project-docs', id],
    queryFn: () => listDocuments({ project_id: id!, limit: 200 }),
    enabled: !!id,
  })

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', board?.id] }),
  })

  if (isLoading || !project) return <div className="p-4 text-muted-foreground">加载中...</div>

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
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/projects')} className="text-muted-foreground"><ArrowLeft size={20} /></button>
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          <h1 className="min-w-0 flex-1 truncate font-bold">{project.name}</h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground ml-8">
          {project.group_name && <span className="rounded-full bg-muted px-2 py-0.5">{project.group_name}</span>}
          {parseTags(project.tags).map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5">{t}</span>)}
          {project.github_url && (
            <span className="flex items-center gap-1"><GitBranch size={12} />{project.github_owner}/{project.github_repo}</span>
          )}
          {project.description && <span>{project.description}</span>}
        </div>
      </div>

      {/* View tabs: 看板 / 文档 */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        <button onClick={() => setViewTab('board')}
          className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', viewTab === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
          <LayoutList size={14} /> 看板
        </button>
        <button onClick={() => setViewTab('docs')}
          className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', viewTab === 'docs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
          <FileText size={14} /> 文档 ({docs.length})
        </button>

        {/* Board sub-tabs */}
        {viewTab === 'board' && boards.length > 1 && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            {boards.map((b, i) => (
              <button key={b.id} onClick={() => setBoardIdx(i)}
                className={cn('shrink-0 rounded-md px-2 py-1 text-xs', i === boardIdx ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
                {b.name}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Board view */}
      {viewTab === 'board' && (
        <>
          {board && tasks.length > 0 && (
            <div className="flex gap-2 items-center px-4 pt-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="搜索任务..." className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}
                className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
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
                  <div key={col.id} className="w-72 shrink-0 snap-center rounded-lg border border-border bg-card md:w-64">
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
                      {colTasks.map((task) => <TaskItem key={task.id} task={task} />)}
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

      {/* Documents view */}
      {viewTab === 'docs' && (
        <div className="p-4">
          {docs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText size={48} className="mx-auto mb-3 opacity-20" />
              <p>此项目暂无关联文档</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {docs.map((doc: Document & { project_name?: string }) => (
                <button key={doc.id} onClick={() => navigate(`/docs/${doc.id}`)}
                  className="rounded-lg border border-border bg-card p-3 text-left active:bg-accent hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-2">
                    <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{doc.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {doc.category && <span className="rounded-full bg-muted px-2 py-0.5">{doc.category}</span>}
                        {parseTags(doc.tags).map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5">{t}</span>)}
                        <span>{dayjs(doc.updated_at).format('YYYY-MM-DD')}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toISOString().split('T')[0])
}

function TaskItem({ task }: { task: Task }) {
  const labels: string[] = (() => { try { return typeof task.labels === 'string' ? JSON.parse(task.labels) : task.labels } catch { return [] } })()

  return (
    <div className={cn('rounded-lg border bg-background p-3', isOverdue(task.due_date) ? 'border-destructive/40' : 'border-border')}>
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

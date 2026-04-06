import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Calendar, GitBranch } from 'lucide-react'
import { getProject, listTasks } from '../api/projects.ts'
import { cn } from '../lib/utils.ts'
import type { Task, Column } from '../types/index.ts'

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-gray-400', none: 'bg-transparent',
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id!), enabled: !!id })
  const [boardIdx, setBoardIdx] = useState(0)

  const board = project?.boards?.[boardIdx]
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', board?.id], queryFn: () => listTasks({ board_id: board!.id }), enabled: !!board })

  if (isLoading || !project) return <div className="p-4 text-muted-foreground">加载中...</div>

  const boards = project.boards ?? []
  const tasksByCol = new Map<string, Task[]>()
  for (const col of board?.columns ?? []) tasksByCol.set(col.id, [])
  for (const t of tasks) {
    if (!t.parent_task_id) tasksByCol.get(t.column_id)?.push(t)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate('/projects')} className="text-muted-foreground"><ArrowLeft size={20} /></button>
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <h1 className="min-w-0 flex-1 truncate font-bold">{project.name}</h1>
        {project.github_url && <GitBranch size={16} className="text-muted-foreground" />}
      </div>

      {project.description && (
        <div className="px-4 py-2 text-sm text-muted-foreground">{project.description}</div>
      )}

      {boards.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {boards.map((b, i) => (
            <button key={b.id} onClick={() => setBoardIdx(i)}
              className={cn('shrink-0 rounded-md px-3 py-1.5 text-sm', i === boardIdx ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Column-based task view — horizontal scroll on mobile */}
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
                </div>
                <div className="space-y-2 p-2 min-h-[80px]">
                  {colTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex items-center justify-center h-16 text-xs text-muted-foreground opacity-40">空</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TaskItem({ task }: { task: Task }) {
  const labels: string[] = (() => { try { return typeof task.labels === 'string' ? JSON.parse(task.labels) : task.labels } catch { return [] } })()

  return (
    <div className="rounded-lg border border-border bg-background p-3">
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
            {task.due_date && <div className="flex items-center gap-1"><Calendar size={11} />{task.due_date}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

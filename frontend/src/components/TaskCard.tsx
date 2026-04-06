import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, ChevronRight } from 'lucide-react'
import type { Task } from '../types/index.ts'
import { cn } from '../lib/utils.ts'

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
  none: 'bg-transparent',
}

interface TaskCardProps {
  task: Task
  onClick: () => void
  overlay?: boolean
}

export default function TaskCard({ task, onClick, overlay }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const labels: string[] = (() => {
    try {
      return typeof task.labels === 'string' ? JSON.parse(task.labels) : task.labels
    } catch {
      return []
    }
  })()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg border border-border bg-background p-3 shadow-sm transition-shadow active:shadow-md',
        isDragging && 'opacity-50',
        overlay && 'shadow-lg rotate-2',
      )}
    >
      <div className="flex items-start gap-2">
        {task.priority !== 'none' && (
          <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', priorityColors[task.priority])} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug">{task.title}</div>

          {labels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {task.progress > 0 && (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-12 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span>{task.progress}%</span>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                <span>{task.due_date}</span>
              </div>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="mt-1 shrink-0 text-muted-foreground opacity-50" />
      </div>
    </div>
  )
}

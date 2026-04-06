import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { Task, Priority } from '../types/index.ts'
import { cn } from '../lib/utils.ts'

const priorities: { value: Priority; label: string; color: string }[] = [
  { value: 'urgent', label: '紧急', color: 'bg-red-500' },
  { value: 'high', label: '高', color: 'bg-orange-500' },
  { value: 'medium', label: '中', color: 'bg-blue-500' },
  { value: 'low', label: '低', color: 'bg-gray-400' },
  { value: 'none', label: '无', color: 'bg-transparent' },
]

interface TaskDetailPanelProps {
  task: Task
  onUpdate: (updates: Partial<Task>) => void
  onDelete: () => void
  onClose: () => void
}

export default function TaskDetailPanel({ task, onUpdate, onDelete, onClose }: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [priority, setPriority] = useState(task.priority)
  const [progress, setProgress] = useState(task.progress)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [labelsText, setLabelsText] = useState(() => {
    try {
      const arr = typeof task.labels === 'string' ? JSON.parse(task.labels) : task.labels
      return (arr as string[]).join(', ')
    } catch {
      return ''
    }
  })

  // Sync when task prop changes
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
    setPriority(task.priority)
    setProgress(task.progress)
    setDueDate(task.due_date ?? '')
  }, [task.id])

  const handleSave = () => {
    const labels = labelsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    onUpdate({
      title,
      description,
      priority,
      progress,
      due_date: dueDate || null,
      labels: labels as unknown as string[],
    })
  }

  const handleDelete = () => {
    if (confirm('确定删除这个任务？')) {
      onDelete()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, right panel on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-card md:inset-y-0 md:left-auto md:right-0 md:w-96 md:max-h-none md:rounded-t-none md:rounded-l-2xl">
        {/* Handle for mobile */}
        <div className="flex justify-center py-2 md:hidden">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-bold">任务详情</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="text-destructive">
              <Trash2 size={18} />
            </button>
            <button onClick={onClose} className="text-muted-foreground">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full bg-transparent text-lg font-medium focus:outline-none"
            placeholder="任务标题"
          />

          {/* Priority */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">优先级</label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  onClick={() => {
                    setPriority(p.value)
                    setTimeout(handleSave, 0)
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                    priority === p.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {p.value !== 'none' && (
                    <div className={cn('h-2 w-2 rounded-full', p.color)} />
                  )}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              进度 {progress}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              onMouseUp={handleSave}
              onTouchEnd={handleSave}
              className="w-full accent-primary"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">截止日期</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                setTimeout(handleSave, 0)
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Labels */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">标签（逗号分隔）</label>
            <input
              type="text"
              value={labelsText}
              onChange={(e) => setLabelsText(e.target.value)}
              onBlur={handleSave}
              placeholder="bug, feature, ..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              rows={6}
              placeholder="添加描述..."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>
    </>
  )
}

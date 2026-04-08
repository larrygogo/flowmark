import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Calendar, Flag, Tag, CheckSquare, FileText, Trash2, AlertTriangle } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { updateTask, deleteTask } from '../api/projects.ts'
import { cn, parseTags } from '../lib/utils.ts'
import type { Task } from '../types/index.ts'

const priorityOptions = [
  { value: 'urgent', label: '紧急', color: 'bg-red-500' },
  { value: 'high', label: '高', color: 'bg-orange-500' },
  { value: 'medium', label: '中', color: 'bg-blue-500' },
  { value: 'low', label: '低', color: 'bg-gray-400' },
  { value: 'none', label: '无', color: 'bg-transparent border border-border' },
]

interface Props {
  task: Task
  boardId?: string
  open: boolean
  onClose: () => void
}

export default function TaskDetailDrawer({ task, boardId, open, onClose }: Props) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<string>('medium')
  const [labels, setLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [progress, setProgress] = useState(0)
  const [editingDesc, setEditingDesc] = useState(false)
  const [editingAC, setEditingAC] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setPriority(task.priority)
      setLabels(parseTags(task.labels))
      setDueDate(task.due_date || '')
      setAcceptanceCriteria(task.acceptance_criteria || '')
      setProgress(task.progress)
      setEditingDesc(false)
      setEditingAC(false)
    }
  }, [task])

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateTask>[1]) => updateTask(task.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', boardId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', boardId] })
      onClose()
    },
  })

  const save = (field: string, value: any) => {
    updateMutation.mutate({ [field]: value })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full md:w-[560px] sidebar-glass border-l border-border animate-slide-left overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border px-4 py-3 glass">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText size={16} />
            <span>需求详情</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (confirm('确定删除此需求？')) deleteMutation.mutate() }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* 标题 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== task.title) save('title', title.trim()) }}
            className="w-full bg-transparent text-lg font-bold text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="需求标题"
          />

          {/* 元信息网格 */}
          <div className="grid grid-cols-[100px_1fr] gap-y-3 gap-x-2 text-sm">
            {/* 优先级 */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Flag size={14} /> 优先级
            </div>
            <div className="flex flex-wrap gap-1.5">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setPriority(opt.value); save('priority', opt.value) }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors',
                    priority === opt.value ? 'bg-accent text-foreground ring-1 ring-primary' : 'text-muted-foreground hover:bg-accent/50'
                  )}
                >
                  <div className={cn('h-2 w-2 rounded-full', opt.color)} />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 截止日期 */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar size={14} /> 截止日期
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); save('due_date', e.target.value || null) }}
              className="rounded-lg border border-border bg-transparent px-2.5 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring w-fit"
            />

            {/* 进度 */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckSquare size={14} /> 进度
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                onMouseUp={() => save('progress', progress)}
                onTouchEnd={() => save('progress', progress)}
                className="flex-1 accent-primary"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">{progress}%</span>
            </div>

            {/* 标签 */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Tag size={14} /> 标签
            </div>
            <div>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => (
                  <button
                    key={l}
                    onClick={() => { const next = labels.filter(x => x !== l); setLabels(next); save('labels', next) }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                  >
                    {l} <span>×</span>
                  </button>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
                      const next = [...labels, newLabel.trim()]
                      setLabels(next)
                      setNewLabel('')
                      save('labels', next)
                    }
                  }}
                  className="inline-flex"
                >
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="+ 添加"
                    className="w-16 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground focus:w-24 transition-all"
                  />
                </form>
              </div>
            </div>
          </div>

          {/* 描述 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">描述</h3>
              <button
                onClick={() => {
                  if (editingDesc) {
                    save('description', description)
                  }
                  setEditingDesc(!editingDesc)
                }}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {editingDesc ? '保存' : '编辑'}
              </button>
            </div>
            {editingDesc ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="用 Markdown 描述需求详情..."
                className="w-full min-h-[120px] rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            ) : description ? (
              <div className="markdown-body rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-sm">
                <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
              </div>
            ) : (
              <button
                onClick={() => setEditingDesc(true)}
                className="w-full rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors text-center"
              >
                点击添加描述
              </button>
            )}
          </div>

          {/* 验收标准 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <AlertTriangle size={14} /> 验收标准
              </h3>
              <button
                onClick={() => {
                  if (editingAC) {
                    save('acceptance_criteria', acceptanceCriteria)
                  }
                  setEditingAC(!editingAC)
                }}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {editingAC ? '保存' : '编辑'}
              </button>
            </div>
            {editingAC ? (
              <textarea
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                placeholder="- [ ] 验收条件 1&#10;- [ ] 验收条件 2&#10;- [ ] 验收条件 3"
                className="w-full min-h-[100px] rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            ) : acceptanceCriteria ? (
              <div className="markdown-body rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-sm">
                <Markdown remarkPlugins={[remarkGfm]}>{acceptanceCriteria}</Markdown>
              </div>
            ) : (
              <button
                onClick={() => setEditingAC(true)}
                className="w-full rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors text-center"
              >
                点击添加验收标准
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

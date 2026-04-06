import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { CheckCircle, Clock, AlertTriangle, FileText, FolderKanban, ListTodo } from 'lucide-react'
import { getDashboard } from '../api/dashboard.ts'
import dayjs from 'dayjs'

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 30000 })
  const navigate = useNavigate()

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">加载中...</div>

  const isEmpty = data.total_tasks === 0 && data.project_summaries.length === 0 && data.total_documents === 0

  return (
    <div className="mx-auto max-w-lg p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">FlowMark</h1>
        <p className="text-sm text-muted-foreground">{dayjs().format('YYYY-MM-DD dddd')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<ListTodo size={18} className="text-indigo-400" />} label="待办" value={data.todo} />
        <Stat icon={<Clock size={18} className="text-blue-400" />} label="进行中" value={data.in_progress} />
        <Stat icon={<CheckCircle size={18} className="text-green-400" />} label="已完成" value={data.done} />
        <Stat icon={<FileText size={18} className="text-yellow-400" />} label="知识库文档" value={data.total_documents} onClick={() => navigate('/docs')} />
      </div>

      {/* Overdue */}
      {data.overdue_tasks.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <AlertTriangle size={14} /> 已逾期
          </h2>
          <div className="space-y-2">
            {data.overdue_tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-destructive/20 bg-card p-3">
                <div className="text-sm font-medium">{task.title}</div>
                <div className="mt-1 text-xs text-destructive">截止 {task.due_date}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent documents */}
      {data.recent_documents.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">最近更新的文档</h2>
          <div className="space-y-2">
            {data.recent_documents.map((doc) => (
              <button key={doc.id} onClick={() => navigate(`/docs/${doc.id}`)}
                className="w-full rounded-lg border border-border bg-card p-3 text-left active:bg-accent transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{doc.title}</span>
                  {doc.category && <span className="shrink-0 ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{doc.category}</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{dayjs(doc.updated_at).format('MM/DD HH:mm')}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Projects */}
      {data.project_summaries.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">项目进度</h2>
          <div className="space-y-2">
            {data.project_summaries.map((p) => {
              const pct = p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0
              return (
                <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left active:bg-accent transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.done_tasks}/{p.total_tasks}</span>
                  </div>
                  {p.total_tasks > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {isEmpty && (
        <div className="py-16 text-center text-muted-foreground">
          <FolderKanban size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">还没有数据</p>
          <p className="mt-1 text-sm">通过 AI 对话创建项目和文档</p>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className="rounded-lg border border-border bg-card p-4 text-left active:bg-accent transition-colors">
      <div className="flex items-center gap-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
    </Comp>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { CheckCircle, Clock, AlertTriangle, StickyNote, FolderKanban } from 'lucide-react'
import { getDashboard } from '../api/dashboard.ts'

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })
  const navigate = useNavigate()

  if (isLoading || !data) {
    return <div className="p-4 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold">总览</h1>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard
          icon={<Clock size={18} className="text-blue-400" />}
          label="进行中"
          value={data.in_progress}
        />
        <StatCard
          icon={<CheckCircle size={18} className="text-green-400" />}
          label="已完成"
          value={data.done}
        />
        <StatCard
          icon={<FolderKanban size={18} className="text-indigo-400" />}
          label="待办"
          value={data.todo}
        />
        <StatCard
          icon={<StickyNote size={18} className="text-yellow-400" />}
          label="未处理记录"
          value={data.pending_notes}
          onClick={() => navigate('/notes')}
        />
      </div>

      {/* Overdue */}
      {data.overdue_tasks.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertTriangle size={14} />
            已逾期
          </h2>
          <div className="space-y-2">
            {data.overdue_tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-destructive/20 bg-card p-3 text-sm"
              >
                <div className="font-medium">{task.title}</div>
                <div className="mt-1 text-xs text-destructive">
                  截止 {task.due_date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {data.project_summaries.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">项目进度</h2>
          <div className="space-y-3">
            {data.project_summaries.map((p) => {
              const pct = p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.done_tasks}/{p.total_tasks}
                    </span>
                  </div>
                  {p.total_tasks > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: p.color }}
                      />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {data.total_tasks === 0 && data.project_summaries.length === 0 && (
        <div className="mt-12 text-center text-muted-foreground">
          <FolderKanban size={48} className="mx-auto mb-3 opacity-30" />
          <p>还没有任何数据</p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            创建第一个项目
          </button>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className="rounded-lg border border-border bg-card p-4 text-left"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Comp>
  )
}

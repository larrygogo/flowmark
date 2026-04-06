import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, Settings, Trash2, GitBranch, LayoutList } from 'lucide-react'
import { useProject, useUpdateProject, useDeleteProject } from '../hooks/useProjects.ts'
import { useBoardTasks, useCreateTask, useUpdateTask, useDeleteTask, useMoveTask } from '../hooks/useTasks.ts'
import KanbanBoard from '../components/KanbanBoard.tsx'
import TaskDetailPanel from '../components/TaskDetailPanel.tsx'
import GitHubPanel from '../components/GitHubPanel.tsx'
import { cn } from '../lib/utils.ts'
import type { Task } from '../types/index.ts'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading } = useProject(id)
  const updateProjectMutation = useUpdateProject()
  const deleteProjectMutation = useDeleteProject()
  const [showSettings, setShowSettings] = useState(false)
  const [activeBoardIdx, setActiveBoardIdx] = useState(0)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [viewTab, setViewTab] = useState<'board' | 'github'>('board')

  const boards = project?.boards ?? []
  const activeBoard = boards[activeBoardIdx]

  const { data: tasks = [] } = useBoardTasks(activeBoard?.id)
  const createTaskMutation = useCreateTask(activeBoard?.id ?? '')
  const updateTaskMutation = useUpdateTask(activeBoard?.id ?? '')
  const deleteTaskMutation = useDeleteTask(activeBoard?.id ?? '')
  const moveTaskMutation = useMoveTask(activeBoard?.id ?? '')

  if (isLoading || !project) {
    return <div className="p-4 text-muted-foreground">加载中...</div>
  }

  const handleDelete = async () => {
    if (!confirm(`确定删除项目「${project.name}」？所有数据将被清除。`)) return
    await deleteProjectMutation.mutateAsync(project.id)
    navigate('/projects')
  }

  const handleArchive = async () => {
    await updateProjectMutation.mutateAsync({ id: project.id, archived: !project.archived })
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate('/projects')} className="text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: project.color }}
        />
        <h1 className="min-w-0 flex-1 truncate font-bold">{project.name}</h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-muted-foreground"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-border bg-card px-4 py-3 space-y-2">
          {project.github_url && (
            <div className="text-sm text-muted-foreground truncate">
              GitHub: {project.github_url}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleArchive}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
            >
              {project.archived ? '取消归档' : '归档'}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive"
            >
              <Trash2 size={14} className="inline mr-1" />
              删除项目
            </button>
          </div>
        </div>
      )}

      {/* View tabs: Board / GitHub */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        <button
          onClick={() => setViewTab('board')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
            viewTab === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          <LayoutList size={14} />
          看板
        </button>
        {project.github_url && (
          <button
            onClick={() => setViewTab('github')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
              viewTab === 'github' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            <GitBranch size={14} />
            GitHub
          </button>
        )}

        {/* Board sub-tabs */}
        {viewTab === 'board' && boards.length > 1 && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            {boards.map((board, idx) => (
              <button
                key={board.id}
                onClick={() => setActiveBoardIdx(idx)}
                className={cn(
                  'shrink-0 rounded-md px-2 py-1 text-xs transition-colors',
                  idx === activeBoardIdx
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {board.name}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Board view */}
      {viewTab === 'board' && activeBoard && (
        <KanbanBoard
          columns={activeBoard.columns}
          tasks={tasks}
          onMoveTask={(taskId, columnId, position) => {
            moveTaskMutation.mutate({ id: taskId, column_id: columnId, position })
          }}
          onCreateTask={(columnId, title) => {
            createTaskMutation.mutate({ column_id: columnId, title })
          }}
          onTaskClick={(task) => setSelectedTask(task)}
        />
      )}

      {viewTab === 'board' && boards.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p>此项目没有看板</p>
        </div>
      )}

      {/* GitHub view */}
      {viewTab === 'github' && (
        <GitHubPanel projectId={project.id} hasGitHub={!!project.github_url} />
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onUpdate={(updates) => {
            updateTaskMutation.mutate({ id: selectedTask.id, ...updates } as Parameters<typeof updateTaskMutation.mutate>[0])
            setSelectedTask({ ...selectedTask, ...updates } as Task)
          }}
          onDelete={() => {
            deleteTaskMutation.mutate(selectedTask.id)
            setSelectedTask(null)
          }}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}

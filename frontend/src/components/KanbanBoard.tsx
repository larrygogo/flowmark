import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { Column, Task } from '../types/index.ts'
import TaskCard from './TaskCard.tsx'
// utilities

interface KanbanBoardProps {
  columns: Column[]
  tasks: Task[]
  onMoveTask: (taskId: string, columnId: string, position: number) => void
  onCreateTask: (columnId: string, title: string) => void
  onTaskClick: (task: Task) => void
}

export default function KanbanBoard({
  columns,
  tasks,
  onMoveTask,
  onCreateTask,
  onTaskClick,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const col of columns) {
      map.set(col.id, [])
    }
    for (const task of tasks) {
      if (!task.parent_task_id) {
        const list = map.get(task.column_id)
        if (list) list.push(task)
      }
    }
    return map
  }, [columns, tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined
    if (task) setActiveTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const overData = over.data.current

    // Determine target column and position
    let targetColumnId: string
    let targetPosition: number

    if (overData?.type === 'task') {
      // Dropped on another task — same column, insert at that position
      const overTask = overData.task as Task
      targetColumnId = overTask.column_id
      const colTasks = tasksByColumn.get(targetColumnId) ?? []
      targetPosition = colTasks.findIndex((t) => t.id === overTask.id)
      if (targetPosition === -1) targetPosition = colTasks.length
    } else if (overData?.type === 'column') {
      // Dropped on column droppable (empty area)
      targetColumnId = over.id as string
      targetPosition = (tasksByColumn.get(targetColumnId) ?? []).length
    } else {
      return
    }

    // Only move if something actually changed
    const draggedTask = tasks.find((t) => t.id === taskId)
    if (draggedTask && (draggedTask.column_id !== targetColumnId || draggedTask.position !== targetPosition)) {
      onMoveTask(taskId, targetColumnId, targetPosition)
    }
  }

  const handleAddTask = (columnId: string) => {
    if (!newTitle.trim()) return
    onCreateTask(columnId, newTitle.trim())
    setNewTitle('')
    setAddingInColumn(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto p-4 snap-x snap-mandatory md:snap-none">
        {columns.map((col) => {
          const colTasks = tasksByColumn.get(col.id) ?? []
          return (
            <div
              key={col.id}
              className="flex w-72 shrink-0 snap-center flex-col rounded-lg border border-border bg-card md:w-64"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <span className="flex-1 text-sm font-medium">{col.name}</span>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                <button
                  onClick={() => {
                    setAddingInColumn(col.id)
                    setNewTitle('')
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Tasks */}
              <SortableContext
                items={colTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="min-h-[80px] flex-1 space-y-2 p-2"
                  data-column-id={col.id}
                >
                  {/* Quick add at top */}
                  {addingInColumn === col.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleAddTask(col.id)
                      }}
                      className="space-y-2"
                    >
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="任务标题"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                        onBlur={() => {
                          if (!newTitle.trim()) setAddingInColumn(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setAddingInColumn(null)
                        }}
                      />
                    </form>
                  )}

                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}

                  {colTasks.length === 0 && addingInColumn !== col.id && (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground opacity-40">
                      拖拽或点击 + 添加
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} onClick={() => {}} overlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}

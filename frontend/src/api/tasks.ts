import type { Task } from '../types/index.ts'
import api from './client.ts'

export async function listTasks(params: {
  column_id?: string
  board_id?: string
  project_id?: string
}) {
  const { data } = await api.get<Task[]>('/tasks', { params })
  return data
}

export async function createTask(req: {
  column_id: string
  title: string
  description?: string
  priority?: string
  labels?: string[]
  due_date?: string
  parent_task_id?: string
}) {
  const { data } = await api.post<Task>('/tasks', req)
  return data
}

export async function getTask(id: string) {
  const { data } = await api.get<{ task: Task; subtasks: Task[] }>(`/tasks/${id}`)
  return data
}

export async function updateTask(
  id: string,
  req: {
    title?: string
    description?: string
    priority?: string
    progress?: number
    labels?: string[]
    due_date?: string | null
    column_id?: string
  },
) {
  const { data } = await api.put<Task>(`/tasks/${id}`, req)
  return data
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`)
}

export async function moveTask(id: string, req: { column_id: string; position: number }) {
  const { data } = await api.put<Task>(`/tasks/${id}/move`, req)
  return data
}

export async function reorderTasks(columnId: string, ids: string[]) {
  await api.put(`/columns/${columnId}/tasks/reorder`, { ids })
}

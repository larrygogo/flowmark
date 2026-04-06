import type { Project, Column, Task } from '../types/index.ts'
import api from './client.ts'

export interface BoardWithColumns {
  id: string
  project_id: string
  name: string
  position: number
  columns: Column[]
}

export interface ProjectDetail extends Project {
  boards: BoardWithColumns[]
}

export async function listProjects() {
  const { data } = await api.get<Project[]>('/projects')
  return data
}

export async function getProject(id: string) {
  const { data } = await api.get<ProjectDetail>(`/projects/${id}`)
  return data
}

export async function listTasks(params: { board_id?: string; project_id?: string }) {
  const { data } = await api.get<Task[]>('/tasks', { params })
  return data
}

export async function listNotes(params?: { is_converted?: boolean }) {
  const { data } = await api.get('/notes', { params })
  return data
}

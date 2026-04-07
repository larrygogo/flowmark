import type { Project, Column, Task, Category, Document } from '../types/index.ts'
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

export async function createProject(req: { name: string; description?: string; github_url?: string; color?: string; group_name?: string }) {
  const { data } = await api.post<Project>('/projects', req)
  return data
}

export async function updateProject(id: string, req: { name?: string; description?: string; github_url?: string; color?: string; group_name?: string; archived?: boolean }) {
  const { data } = await api.put<Project>(`/projects/${id}`, req)
  return data
}

export async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`)
}

export async function listTasks(params: { board_id?: string; project_id?: string }) {
  const { data } = await api.get<Task[]>('/tasks', { params })
  return data
}

export async function createTask(req: { column_id: string; title: string; priority?: string }) {
  const { data } = await api.post<Task>('/tasks', req)
  return data
}

export async function listCategories() {
  const { data } = await api.get<Category[]>('/categories')
  return data
}

export async function listDocuments(params?: { category?: string; project_id?: string; status?: string; limit?: number }) {
  const { data } = await api.get<(Document & { project_name?: string })[]>('/documents', { params })
  return data
}

export async function getDocument(id: string) {
  const { data } = await api.get<Document>(`/documents/${id}`)
  return data
}

import type { Project, Column, Task, Category, Document, Folder } from '../types/index.ts'
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

export async function updateProject(id: string, req: { name?: string; description?: string; github_url?: string; color?: string; group_name?: string; archived?: boolean; tags?: string[] }) {
  const { data } = await api.put<Project>(`/projects/${id}`, req)
  return data
}

export async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`)
}

// --- Folders ---
export async function listFolders(projectId: string) {
  const { data } = await api.get<Folder[]>(`/projects/${projectId}/folders`)
  return data
}

export async function createFolder(projectId: string, req: { name: string; parent_id?: string | null }) {
  const { data } = await api.post<Folder>(`/projects/${projectId}/folders`, req)
  return data
}

export async function updateFolder(id: string, req: { name?: string; parent_id?: string | null }) {
  const { data } = await api.put<Folder>(`/folders/${id}`, req)
  return data
}

export async function deleteFolder(id: string) {
  await api.delete(`/folders/${id}`)
}

// --- Tasks ---
export async function listTasks(params: { board_id?: string; project_id?: string }) {
  const { data } = await api.get<Task[]>('/tasks', { params })
  return data
}

export async function createTask(req: { column_id: string; title: string; description?: string; priority?: string; labels?: string[]; due_date?: string; acceptance_criteria?: string }) {
  const { data } = await api.post<Task>('/tasks', req)
  return data
}

export async function getTask(id: string) {
  const { data } = await api.get<{ task: Task; subtasks: Task[] }>(`/tasks/${id}`)
  return data
}

export async function updateTask(id: string, req: { title?: string; description?: string; priority?: string; progress?: number; labels?: string[]; due_date?: string | null; column_id?: string; acceptance_criteria?: string }) {
  const { data } = await api.put<Task>(`/tasks/${id}`, req)
  return data
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`)
}

export async function listCategories() {
  const { data } = await api.get<Category[]>('/categories')
  return data
}

export interface DocumentListResponse {
  items: (Document & { project_name?: string; match_snippet?: string })[]
  total: number
  page: number
  page_size: number
}

export async function listDocuments(params?: { category?: string; project_id?: string; folder_id?: string; status?: string; search?: string; tags?: string; page?: number; page_size?: number }) {
  const { data } = await api.get<DocumentListResponse>('/documents', { params })
  return data
}

export async function getDocument(id: string) {
  const { data } = await api.get<Document>(`/documents/${id}`)
  return data
}

export async function createDocument(req: { title: string; content?: string; category_id?: string; project_id?: string | null; folder_id?: string | null; tags?: string[]; status?: string }) {
  const { data } = await api.post<Document>('/documents', req)
  return data
}

export async function updateDocument(id: string, req: { title?: string; content?: string; tags?: string[]; status?: string; folder_id?: string | null }) {
  const { data } = await api.put<Document>(`/documents/${id}`, req)
  return data
}

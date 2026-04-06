import type { Project } from '../types/index.ts'
import api from './client.ts'

export interface ProjectDetail extends Project {
  boards: BoardWithColumns[]
}

export interface BoardWithColumns {
  id: string
  project_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
  columns: import('../types/index.ts').Column[]
}

export async function listProjects() {
  const { data } = await api.get<Project[]>('/projects')
  return data
}

export async function getProject(id: string) {
  const { data } = await api.get<ProjectDetail>(`/projects/${id}`)
  return data
}

export async function createProject(req: {
  name: string
  description?: string
  github_url?: string
  color?: string
}) {
  const { data } = await api.post<Project>('/projects', req)
  return data
}

export async function updateProject(
  id: string,
  req: {
    name?: string
    description?: string
    github_url?: string
    color?: string
    archived?: boolean
  },
) {
  const { data } = await api.put<Project>(`/projects/${id}`, req)
  return data
}

export async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`)
}

import type { Task } from '../types/index.ts'
import api from './client.ts'

export interface DashboardData {
  total_tasks: number
  in_progress: number
  done: number
  todo: number
  overdue_tasks: Task[]
  project_summaries: {
    id: string
    name: string
    color: string
    total_tasks: number
    done_tasks: number
  }[]
  total_documents: number
  recent_documents: {
    id: string
    title: string
    category: string | null
    updated_at: string
  }[]
}

export async function getDashboard() {
  const { data } = await api.get<DashboardData>('/dashboard')
  return data
}

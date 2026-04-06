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
  pending_notes: number
}

export async function getDashboard() {
  const { data } = await api.get<DashboardData>('/dashboard')
  return data
}

export interface Project {
  id: string
  name: string
  description: string
  github_url: string | null
  github_owner: string | null
  github_repo: string | null
  color: string
  archived: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface Board {
  id: string
  project_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

export interface Column {
  id: string
  board_id: string
  name: string
  color: string
  position: number
  wip_limit: number | null
  created_at: string
  updated_at: string
}

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none'

export interface Task {
  id: string
  column_id: string
  parent_task_id: string | null
  title: string
  description: string
  priority: Priority
  progress: number
  labels: string[]
  due_date: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface QuickNote {
  id: string
  project_id: string | null
  content: string
  is_converted: boolean
  task_id: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

import api from './client.ts'

export interface GitHubCachedItem {
  id: string
  project_id: string
  item_type: string
  github_id: number
  title: string
  state: string
  author: string | null
  labels: string
  github_created_at: string | null
  github_updated_at: string | null
  synced_at: string
}

export async function getIssues(projectId: string) {
  const { data } = await api.get<GitHubCachedItem[]>(`/projects/${projectId}/github/issues`)
  return data
}

export async function getPulls(projectId: string) {
  const { data } = await api.get<GitHubCachedItem[]>(`/projects/${projectId}/github/pulls`)
  return data
}

export async function syncGitHub(projectId: string) {
  const { data } = await api.post<{ synced_count: number }>(`/projects/${projectId}/github/sync`)
  return data
}

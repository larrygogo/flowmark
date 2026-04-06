import { useQuery } from '@tanstack/react-query'
import { listProjects, getProject } from '../api/projects.ts'

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: listProjects })
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: ['project', id], queryFn: () => getProject(id!), enabled: !!id })
}

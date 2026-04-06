import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProject, deleteProject, getProject, listProjects, updateProject } from '../api/projects.ts'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string; name?: string; description?: string; github_url?: string; color?: string; archived?: boolean }) =>
      updateProject(id, req),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project', vars.id] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

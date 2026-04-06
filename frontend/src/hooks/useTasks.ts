import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTask, deleteTask, getTask, listTasks, moveTask, updateTask } from '../api/tasks.ts'

export function useBoardTasks(boardId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'board', boardId],
    queryFn: () => listTasks({ board_id: boardId }),
    enabled: !!boardId,
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => getTask(id!),
    enabled: !!id,
  })
}

export function useCreateTask(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', 'board', boardId] }),
  })
}

export function useUpdateTask(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...req }: Parameters<typeof updateTask>[1] & { id: string }) =>
      updateTask(id, req),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', 'board', boardId] })
      qc.invalidateQueries({ queryKey: ['task', vars.id] })
    },
  })
}

export function useDeleteTask(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', 'board', boardId] }),
  })
}

export function useMoveTask(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string; column_id: string; position: number }) =>
      moveTask(id, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', 'board', boardId] }),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createNote, deleteNote, listNotes, updateNote, convertNoteToTask } from '../api/notes.ts'

export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: () => listNotes({ is_converted: false }),
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string; content?: string; pinned?: boolean }) =>
      updateNote(id, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useConvertNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string; column_id: string; priority?: string }) =>
      convertNoteToTask(id, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

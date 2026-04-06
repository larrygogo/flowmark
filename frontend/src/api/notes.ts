import type { QuickNote, Task } from '../types/index.ts'
import api from './client.ts'

export async function listNotes(params?: { project_id?: string; is_converted?: boolean }) {
  const { data } = await api.get<QuickNote[]>('/notes', { params })
  return data
}

export async function createNote(req: { content: string; project_id?: string }) {
  const { data } = await api.post<QuickNote>('/notes', req)
  return data
}

export async function updateNote(
  id: string,
  req: { content?: string; project_id?: string | null; pinned?: boolean },
) {
  const { data } = await api.put<QuickNote>(`/notes/${id}`, req)
  return data
}

export async function deleteNote(id: string) {
  await api.delete(`/notes/${id}`)
}

export async function convertNoteToTask(
  id: string,
  req: { column_id: string; priority?: string },
) {
  const { data } = await api.post<Task>(`/notes/${id}/convert-to-task`, req)
  return data
}

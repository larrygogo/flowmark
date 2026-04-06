import type { Column } from '../types/index.ts'
import api from './client.ts'

export async function createColumn(boardId: string, req: { name: string; color?: string }) {
  const { data } = await api.post<Column>(`/boards/${boardId}/columns`, req)
  return data
}

export async function updateColumn(
  id: string,
  req: { name?: string; color?: string; wip_limit?: number | null },
) {
  const { data } = await api.put<Column>(`/columns/${id}`, req)
  return data
}

export async function deleteColumn(id: string) {
  await api.delete(`/columns/${id}`)
}

export async function reorderColumns(boardId: string, ids: string[]) {
  await api.put(`/boards/${boardId}/columns/reorder`, { ids })
}

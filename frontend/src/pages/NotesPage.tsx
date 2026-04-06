import { useQuery } from '@tanstack/react-query'
import { Pin, StickyNote } from 'lucide-react'
import { listNotes } from '../api/projects.ts'
import { cn } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { QuickNote } from '../types/index.ts'

export default function NotesPage() {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => listNotes({ is_converted: false }) as Promise<QuickNote[]>,
    refetchInterval: 30000,
  })

  const pinned = notes.filter((n: QuickNote) => n.pinned)
  const regular = notes.filter((n: QuickNote) => !n.pinned)

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold">记录</h1>
      <p className="mt-1 text-sm text-muted-foreground">灵感、想法、待验证的点子</p>

      {isLoading && <div className="mt-8 text-center text-muted-foreground">加载中...</div>}

      {pinned.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Pin size={12} /> 置顶
          </h2>
          <div className="space-y-2">
            {pinned.map((n: QuickNote) => <NoteCard key={n.id} note={n} />)}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {regular.map((n: QuickNote) => <NoteCard key={n.id} note={n} />)}
      </div>

      {notes.length === 0 && !isLoading && (
        <div className="py-16 text-center text-muted-foreground">
          <StickyNote size={48} className="mx-auto mb-4 opacity-20" />
          <p>还没有记录</p>
          <p className="text-sm mt-1">通过 AI 对话记录想法</p>
        </div>
      )}
    </div>
  )
}

function NoteCard({ note }: { note: QuickNote }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-3', note.pinned && 'border-primary/30')}>
      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{dayjs(note.created_at).format('MM/DD HH:mm')}</span>
        {note.pinned && <Pin size={11} className="text-primary" />}
      </div>
    </div>
  )
}

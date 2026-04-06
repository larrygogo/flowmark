import { useState } from 'react'
import { Plus, Pin, Trash2 } from 'lucide-react'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../hooks/useNotes.ts'
import { cn } from '../lib/utils.ts'
import dayjs from 'dayjs'

export default function NotesPage() {
  const { data: notes = [], isLoading } = useNotes()
  const createMutation = useCreateNote()
  const updateMutation = useUpdateNote()
  const deleteMutation = useDeleteNote()
  const [content, setContent] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    await createMutation.mutateAsync({ content: content.trim() })
    setContent('')
  }

  const pinnedNotes = notes.filter((n) => n.pinned)
  const regularNotes = notes.filter((n) => !n.pinned)

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold">快捷记录</h1>
      <p className="mt-1 text-sm text-muted-foreground">灵感、想法、备忘</p>

      {/* Quick input */}
      <form onSubmit={handleCreate} className="mt-4 flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录一个想法..."
          className="flex-1 rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!content.trim() || createMutation.isPending}
          className="shrink-0 rounded-lg bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50"
        >
          <Plus size={18} />
        </button>
      </form>

      {isLoading && <div className="mt-8 text-center text-muted-foreground">加载中...</div>}

      {/* Pinned */}
      {pinnedNotes.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Pin size={12} /> 置顶
          </h2>
          <div className="space-y-2">
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onPin={() => updateMutation.mutate({ id: note.id, pinned: false })}
                onDelete={() => deleteMutation.mutate(note.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular */}
      <div className="mt-4 space-y-2">
        {regularNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onPin={() => updateMutation.mutate({ id: note.id, pinned: true })}
            onDelete={() => deleteMutation.mutate(note.id)}
          />
        ))}
      </div>

      {notes.length === 0 && !isLoading && (
        <div className="mt-12 text-center text-muted-foreground">
          <p className="text-sm">还没有记录</p>
          <p className="text-xs mt-1">在上方输入框随手记下想法</p>
        </div>
      )}
    </div>
  )
}

function NoteCard({
  note,
  onPin,
  onDelete,
}: {
  note: import('../types/index.ts').QuickNote
  onPin: () => void
  onDelete: () => void
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-3">
      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {dayjs(note.created_at).format('MM/DD HH:mm')}
        </span>
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={onPin} className="text-muted-foreground hover:text-foreground">
            <Pin size={14} className={cn(note.pinned && 'text-primary')} />
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

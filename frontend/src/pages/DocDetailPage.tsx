import { useParams, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText } from 'lucide-react'
import { getDocument } from '../api/projects.ts'
import dayjs from 'dayjs'

export default function DocDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: doc, isLoading } = useQuery({ queryKey: ['document', id], queryFn: () => getDocument(id!), enabled: !!id })

  if (isLoading || !doc) return <div className="p-4 text-muted-foreground">加载中...</div>

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate('/docs')} className="text-muted-foreground"><ArrowLeft size={20} /></button>
        <FileText size={18} className="text-muted-foreground" />
        <h1 className="min-w-0 flex-1 truncate font-bold">{doc.title}</h1>
      </div>

      <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border">
        {doc.category && <span className="rounded-full bg-muted px-2 py-0.5">{doc.category}</span>}
        <span>更新于 {dayjs(doc.updated_at).format('YYYY-MM-DD HH:mm')}</span>
      </div>

      <article className="prose prose-invert prose-sm max-w-none px-4 py-4">
        {/* Simple markdown rendering — just whitespace preserved */}
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{doc.content}</pre>
      </article>
    </div>
  )
}

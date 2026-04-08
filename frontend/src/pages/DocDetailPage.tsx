import { useState, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Download, Pencil, Check, X, ArrowLeft } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { getDocument, updateDocument } from '../api/projects.ts'
import { parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import 'highlight.js/styles/github-dark.min.css'

const MilkdownEditor = lazy(() => import('../components/MilkdownEditor.tsx'))

export default function DocDetailPage() {
  const { id, pid } = useParams()
  const [searchParams] = useSearchParams()
  const folderId = searchParams.get('folder')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isFromProject = !!pid
  const { data: doc, isLoading } = useQuery({ queryKey: ['document', id], queryFn: () => getDocument(id!), enabled: !!id })

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; content?: string }) => updateDocument(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] })
      setEditing(false)
    },
  })

  if (isLoading || !doc) return <div className="p-4 text-muted-foreground">加载中...</div>

  const d = doc as typeof doc & { project_name?: string; project_color?: string }

  const handleDownload = () => {
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const startEditing = () => {
    setEditTitle(doc.title)
    setEditContent(doc.content)
    setEditing(true)
  }

  const saveEdit = () => {
    updateMutation.mutate({ title: editTitle.trim(), content: editContent })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {isFromProject && (
          <button
            onClick={() => navigate(`/projects/${pid}?view=docs${folderId ? `&folder=${folderId}` : ''}`)}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <FileText size={18} className="text-muted-foreground" />
        {editing ? (
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="min-w-0 flex-1 font-bold bg-transparent border-b border-primary outline-none text-foreground" />
        ) : (
          <h1 className="min-w-0 flex-1 truncate font-bold">{doc.title}</h1>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={saveEdit} disabled={updateMutation.isPending}
                className="p-1.5 text-primary hover:text-primary/80 transition-colors" title="保存">
                <Check size={18} />
              </button>
              <button onClick={() => setEditing(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="取消">
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditing} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="编辑">
                <Pencil size={18} />
              </button>
              <button onClick={handleDownload} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="下载 Markdown">
                <Download size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-b border-border">
        {doc.category && <span className="rounded-full bg-muted px-2 py-0.5">{doc.category}</span>}
        {d.project_name && (
          <button
            onClick={() => navigate(`/projects/${doc.project_id}`)}
            className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5"
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.project_color }} />
            {d.project_name}
          </button>
        )}
        {parseTags(doc.tags).map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5">{t}</span>)}
        <span>更新于 {dayjs(doc.updated_at).format('YYYY-MM-DD HH:mm')}</span>
      </div>

      {editing ? (
        <div className="min-h-[60dvh] px-4 py-4">
          <Suspense fallback={<div className="text-muted-foreground text-sm">加载编辑器...</div>}>
            <MilkdownEditor
              defaultValue={editContent}
              onChange={setEditContent}
            />
          </Suspense>
        </div>
      ) : (
        <div className="markdown-body px-4 py-6">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {doc.content}
          </Markdown>
        </div>
      )}
    </div>
  )
}

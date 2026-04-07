import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, Download } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { getDocument } from '../api/projects.ts'
import { parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import 'highlight.js/styles/github-dark.min.css'

export default function DocDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromProject = searchParams.get('from') === 'project'
  const projectId = searchParams.get('pid')
  const { data: doc, isLoading } = useQuery({ queryKey: ['document', id], queryFn: () => getDocument(id!), enabled: !!id })

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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(fromProject && projectId ? `/projects/${projectId}` : '/docs')} className="text-muted-foreground"><ArrowLeft size={20} /></button>
        <FileText size={18} className="text-muted-foreground" />
        <h1 className="min-w-0 flex-1 truncate font-bold">{doc.title}</h1>
        <button onClick={handleDownload} className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="下载 Markdown">
          <Download size={18} />
        </button>
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

      <div className="markdown-body px-4 py-6">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {doc.content}
        </Markdown>
      </div>
    </div>
  )
}

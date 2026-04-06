import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FileText, FolderOpen } from 'lucide-react'
import { listCategories, listDocuments } from '../api/projects.ts'
import { cn } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { Document } from '../types/index.ts'

export default function DocsPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', activeCategory],
    queryFn: () => listDocuments({ category: activeCategory || undefined, limit: 100 }),
  })

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold">知识库</h1>

      {/* Category pills */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
            !activeCategory ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border',
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.name)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
              activeCategory === cat.name ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border',
            )}
          >
            {cat.name} <span className="opacity-60">({cat.doc_count})</span>
          </button>
        ))}
      </div>

      {/* Document list */}
      <div className="mt-4 space-y-2">
        {isLoading && <div className="text-muted-foreground">加载中...</div>}
        {docs.map((doc: Document) => (
          <button
            key={doc.id}
            onClick={() => navigate(`/docs/${doc.id}`)}
            className="w-full rounded-lg border border-border bg-card p-3 text-left active:bg-accent transition-colors"
          >
            <div className="flex items-start gap-2">
              <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {doc.category && <span className="rounded-full bg-muted px-2 py-0.5">{doc.category}</span>}
                  <span>{dayjs(doc.updated_at).format('YYYY-MM-DD')}</span>
                  {doc.status !== 'published' && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5',
                      doc.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500' :
                      doc.status === 'to_verify' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-muted text-muted-foreground'
                    )}>{doc.status}</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}

        {!isLoading && docs.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
            <p>{activeCategory ? `"${activeCategory}" 分类下暂无文档` : '知识库为空'}</p>
            <p className="text-sm mt-1">通过 AI 对话添加文档</p>
          </div>
        )}
      </div>
    </div>
  )
}

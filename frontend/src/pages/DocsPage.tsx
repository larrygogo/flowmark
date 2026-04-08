import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FileText, FolderOpen, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { listCategories, listDocuments, listProjects } from '../api/projects.ts'
import { parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { Document } from '../types/index.ts'

const PAGE_SIZE = 20

export default function DocsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [activeProjectId, setActiveProjectId] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [activeCategory, activeProjectId, activeTag])

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const { data, isLoading } = useQuery({
    queryKey: ['documents', activeCategory, activeProjectId, activeTag, debouncedSearch, page],
    queryFn: () => listDocuments({
      category: activeCategory || undefined,
      project_id: activeProjectId || undefined,
      tags: activeTag || undefined,
      search: debouncedSearch || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
  })

  const docs = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Collect tags from current page for the filter dropdown
  const allTags = [...new Set(docs.flatMap((d: Document) => parseTags(d.tags)))]

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标题和内容..."
          className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Filter pills */}
      {(categories.length > 0 || projects.filter(p => !p.archived).length > 0 || allTags.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.name ? '' : cat.name)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${activeCategory === cat.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {cat.name}
            </button>
          ))}
          {categories.length > 0 && projects.filter(p => !p.archived).length > 0 && <div className="w-px h-5 bg-border self-center mx-0.5" />}
          {projects.filter(p => !p.archived).map((p) => (
            <button key={p.id} onClick={() => setActiveProjectId(activeProjectId === p.id ? '' : p.id)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${activeProjectId === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {p.name}
            </button>
          ))}
          {allTags.length > 0 && <div className="w-px h-5 bg-border self-center mx-0.5" />}
          {allTags.map(t => (
            <button key={t} onClick={() => setActiveTag(activeTag === t ? '' : t)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${activeTag === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Document grid */}
      <div className="mt-4">
        {isLoading && <div className="text-muted-foreground">加载中...</div>}

        {!isLoading && docs.length > 0 && (
          <div className="text-xs text-muted-foreground mb-3">{total} 篇文档</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {docs.map((doc: Document & { project_name?: string; match_snippet?: string }) => (
            <button key={doc.id} onClick={() => navigate(`/docs/${doc.id}`)}
              className="rounded-xl border border-border bg-card p-3 text-left active:bg-accent hover:bg-accent/50 transition-colors">
              <div className="flex items-start gap-2">
                <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{doc.title}</div>
                  {doc.match_snippet && (
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: doc.match_snippet.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;&lt;/g, '<mark class="bg-yellow-500/30 text-foreground rounded px-0.5">').replace(/&gt;&gt;/g, '</mark>') }} />
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {doc.category && <span className="rounded-full bg-muted px-2 py-0.5">{doc.category}</span>}
                    {doc.project_name && <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5">{doc.project_name}</span>}
                    {parseTags(doc.tags).map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5">{t}</span>)}
                    <span>{dayjs(doc.updated_at).format('YYYY-MM-DD')}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {!isLoading && docs.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
            <p>{debouncedSearch ? `未找到 "${debouncedSearch}"` : '暂无文档'}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-xl border border-border p-2 text-sm disabled:opacity-30 hover:bg-accent transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-xl border border-border p-2 text-sm disabled:opacity-30 hover:bg-accent transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

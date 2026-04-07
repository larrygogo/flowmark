import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FileText, FolderOpen, Search } from 'lucide-react'
import { listCategories, listDocuments, listProjects } from '../api/projects.ts'
import { cn, parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { Document } from '../types/index.ts'

export default function DocsPage() {
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeCategory, setActiveCategory] = useState('')
  const [activeProjectId, setActiveProjectId] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', activeCategory, activeProjectId],
    queryFn: () => listDocuments({
      category: activeCategory || undefined,
      project_id: activeProjectId || undefined,
      limit: 200,
    }),
  })

  const filtered = search
    ? docs.filter((d: Document & { project_name?: string }) =>
        d.title.toLowerCase().includes(search.toLowerCase()))
    : docs

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="text-xl font-bold">知识库</h1>

      {/* Filters */}
      <div className="mt-3 flex gap-2 items-center">
        <div className={cn('relative transition-all', searchFocused ? 'flex-1' : 'flex-1')}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input ref={searchRef} type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => { if (!search) setSearchFocused(false) }}
            placeholder="搜索..."
            className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {searchFocused && !search ? null : searchFocused ? (
          <button onClick={() => { setSearch(''); setSearchFocused(false); searchRef.current?.blur() }}
            className="shrink-0 text-sm text-primary md:hidden">取消</button>
        ) : null}
        {(!searchFocused || window.innerWidth >= 768) && (
          <>
            <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}
              className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">分类</option>
              {categories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name} ({cat.doc_count})</option>)}
            </select>
            <select value={activeProjectId} onChange={(e) => setActiveProjectId(e.target.value)}
              className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">项目</option>
              {projects.filter(p => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Document grid */}
      <div className="mt-4">
        {isLoading && <div className="text-muted-foreground">加载中...</div>}

        {!isLoading && filtered.length > 0 && (
          <div className="text-xs text-muted-foreground mb-3">{filtered.length} 篇文档</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((doc: Document & { project_name?: string }) => (
            <button key={doc.id} onClick={() => navigate(`/docs/${doc.id}`)}
              className="rounded-lg border border-border bg-card p-3 text-left active:bg-accent hover:bg-accent/50 transition-colors">
              <div className="flex items-start gap-2">
                <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{doc.title}</div>
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

        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
            <p>{search ? `未找到 "${search}"` : '暂无文档'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

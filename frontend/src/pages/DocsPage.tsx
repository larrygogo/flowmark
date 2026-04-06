import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FileText, FolderOpen } from 'lucide-react'
import { listCategories, listDocuments, listProjects } from '../api/projects.ts'
import { cn } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { Document } from '../types/index.ts'

export default function DocsPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', activeCategory, activeProjectId],
    queryFn: () => listDocuments({
      category: activeCategory || undefined,
      project_id: activeProjectId || undefined,
      limit: 100,
    }),
  })

  const activeProjectName = activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : null

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold">知识库</h1>

      {/* Category filter */}
      <div className="mt-3">
        <div className="text-xs text-muted-foreground mb-1.5">分类</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Pill active={!activeCategory} onClick={() => setActiveCategory(null)}>全部</Pill>
          {categories.map((cat) => (
            <Pill key={cat.id} active={activeCategory === cat.name} onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}>
              {cat.name} ({cat.doc_count})
            </Pill>
          ))}
        </div>
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1.5">项目</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Pill active={!activeProjectId} onClick={() => setActiveProjectId(null)}>全部</Pill>
            {projects.filter(p => !p.archived).map((p) => (
              <Pill key={p.id} active={activeProjectId === p.id} onClick={() => setActiveProjectId(activeProjectId === p.id ? null : p.id)}>
                <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: p.color }} />
                {p.name}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="mt-4 space-y-2">
        {isLoading && <div className="text-muted-foreground">加载中...</div>}
        {docs.map((doc: Document & { project_name?: string }) => (
          <button
            key={doc.id}
            onClick={() => navigate(`/docs/${doc.id}`)}
            className="w-full rounded-lg border border-border bg-card p-3 text-left active:bg-accent transition-colors"
          >
            <div className="flex items-start gap-2">
              <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {doc.category && <span className="rounded-full bg-muted px-2 py-0.5">{doc.category}</span>}
                  {doc.project_name && <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5">{doc.project_name}</span>}
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
            <p>
              {activeCategory && activeProjectName
                ? `"${activeCategory}" + "${activeProjectName}" 下暂无文档`
                : activeCategory ? `"${activeCategory}" 下暂无文档`
                : activeProjectName ? `"${activeProjectName}" 下暂无文档`
                : '知识库为空'}
            </p>
            <p className="text-sm mt-1">通过 AI 对话添加文档</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors flex items-center',
        active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border',
      )}>
      {children}
    </button>
  )
}

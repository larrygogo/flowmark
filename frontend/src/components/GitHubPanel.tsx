import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, GitPullRequest, CircleDot } from 'lucide-react'
import { getIssues, getPulls, syncGitHub, type GitHubCachedItem } from '../api/github.ts'
import { cn } from '../lib/utils.ts'

interface GitHubPanelProps {
  projectId: string
  hasGitHub: boolean
}

export default function GitHubPanel({ projectId, hasGitHub }: GitHubPanelProps) {
  const [tab, setTab] = useState<'issues' | 'pulls'>('issues')
  const qc = useQueryClient()

  const { data: issues = [], isLoading: loadingIssues } = useQuery({
    queryKey: ['github', 'issues', projectId],
    queryFn: () => getIssues(projectId),
    enabled: hasGitHub,
  })

  const { data: pulls = [], isLoading: loadingPulls } = useQuery({
    queryKey: ['github', 'pulls', projectId],
    queryFn: () => getPulls(projectId),
    enabled: hasGitHub,
  })

  const syncMutation = useMutation({
    mutationFn: () => syncGitHub(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github', 'issues', projectId] })
      qc.invalidateQueries({ queryKey: ['github', 'pulls', projectId] })
    },
  })

  if (!hasGitHub) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>此项目未关联 GitHub 仓库</p>
        <p className="mt-1 text-sm">在项目设置中添加 GitHub URL</p>
      </div>
    )
  }

  const items = tab === 'issues' ? issues : pulls
  const loading = tab === 'issues' ? loadingIssues : loadingPulls

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('issues')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
              tab === 'issues' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            <CircleDot size={14} />
            Issues ({issues.length})
          </button>
          <button
            onClick={() => setTab('pulls')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
              tab === 'pulls' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            <GitPullRequest size={14} />
            PRs ({pulls.length})
          </button>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={16} className={cn(syncMutation.isPending && 'animate-spin')} />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
        {items.map((item) => (
          <GitHubItemCard key={item.id} item={item} />
        ))}
        {!loading && items.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            暂无{tab === 'issues' ? ' Issues' : ' Pull Requests'}
          </div>
        )}
      </div>
    </div>
  )
}

function GitHubItemCard({ item }: { item: GitHubCachedItem }) {
  const labels: string[] = (() => {
    try {
      return JSON.parse(item.labels)
    } catch {
      return []
    }
  })()

  const isOpen = item.state === 'open'

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
            isOpen ? 'bg-green-500' : 'bg-purple-500',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug">
            <span className="text-muted-foreground">#{item.github_id}</span>{' '}
            {item.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.author && <span>{item.author}</span>}
            <span>{item.state}</span>
            {labels.map((l) => (
              <span key={l} className="rounded-full bg-muted px-2 py-0.5">
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

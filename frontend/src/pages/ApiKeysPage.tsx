import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react'
import { listApiKeys, createApiKey, deleteApiKey, type ApiKey } from '../api/projects.ts'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export default function ApiKeysPage() {
  const qc = useQueryClient()
  const { data: keys = [], isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys })

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [expiresIn, setExpiresIn] = useState('never')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      setNewKey(data.key ?? null)
      setShowCreate(false)
      setName('')
      setExpiresIn('never')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const handleCreate = () => {
    let expires_at: string | null = null
    if (expiresIn === '7d') expires_at = dayjs().add(7, 'day').toISOString()
    else if (expiresIn === '30d') expires_at = dayjs().add(30, 'day').toISOString()
    else if (expiresIn === '90d') expires_at = dayjs().add(90, 'day').toISOString()
    else if (expiresIn === '1y') expires_at = dayjs().add(1, 'year').toISOString()
    createMutation.mutate({ name: name.trim() || 'Unnamed', expires_at })
  }

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isExpired = (k: ApiKey) => k.expires_at && new Date(k.expires_at) < new Date()

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
        <button onClick={() => { setShowCreate(true); setNewKey(null) }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
          <Plus size={14} /> 创建
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        API Key 用于远程 Agent 通过 MCP 连接 FlowMark。端点：<code className="bg-muted px-1.5 py-0.5 rounded text-xs">https://fm.larrygo.com/mcp</code>
      </p>

      {/* New key display */}
      {newKey && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium mb-2">Key 已创建，请立即复制（不会再次显示）：</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all">{newKey}</code>
            <button onClick={copyKey} className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Claude Code 配置：
          </p>
          <pre className="mt-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono overflow-x-auto">
{`{
  "mcpServers": {
    "flowmark": {
      "type": "streamable-http",
      "url": "https://fm.larrygo.com/mcp",
      "headers": {
        "Authorization": "Bearer ${newKey}"
      }
    }
  }
}`}
          </pre>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key 名称（如：Claude Code、服务器 A）"
            autoFocus className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">过期时间</label>
            <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="never">永不过期</option>
              <option value="7d">7 天</option>
              <option value="30d">30 天</option>
              <option value="90d">90 天</option>
              <option value="1y">1 年</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createMutation.isPending}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {createMutation.isPending ? '创建中...' : '创建 Key'}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">取消</button>
          </div>
        </div>
      )}

      {/* Key list */}
      {isLoading && <div className="text-muted-foreground text-sm">加载中...</div>}

      <div className="space-y-1">
        {keys.map((k: ApiKey) => (
          <div key={k.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Key size={16} className={`shrink-0 ${isExpired(k) ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{k.name}</span>
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{k.key_prefix}</code>
                {isExpired(k) && <span className="text-xs text-destructive">已过期</span>}
              </div>
              <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-muted-foreground">
                <span>创建于 {dayjs(k.created_at).format('YYYY-MM-DD')}</span>
                {k.expires_at && <span>过期 {dayjs(k.expires_at).format('YYYY-MM-DD')}</span>}
                {k.last_used_at ? <span>最后使用 {dayjs(k.last_used_at).fromNow()}</span> : <span>未使用</span>}
              </div>
            </div>
            <button onClick={() => { if (confirm(`删除 Key「${k.name}」？`)) deleteMutation.mutate(k.id) }}
              className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {!isLoading && keys.length === 0 && !showCreate && (
        <div className="py-12 text-center text-muted-foreground">
          <Key size={48} className="mx-auto mb-3 opacity-20" />
          <p>暂无 API Key</p>
          <p className="mt-1 text-xs">创建一个 Key 以允许远程 Agent 连接</p>
        </div>
      )}
    </div>
  )
}

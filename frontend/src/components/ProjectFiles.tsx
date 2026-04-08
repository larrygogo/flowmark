import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Folder as FolderIcon, FileText, Plus, ChevronRight, ArrowLeft, Pencil, Trash2, FolderPlus, FilePlus, MoveRight } from 'lucide-react'
import { listFolders, createFolder, updateFolder, deleteFolder, listDocuments, createDocument, updateDocument } from '../api/projects.ts'
import { parseTags } from '../lib/utils.ts'
import dayjs from 'dayjs'
import type { Folder, Document } from '../types/index.ts'

export default function ProjectFiles({ projectId }: { projectId: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: '根目录' }])
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [movingDocId, setMovingDocId] = useState<string | null>(null)

  const { data: allFolders = [] } = useQuery({
    queryKey: ['folders', projectId],
    queryFn: () => listFolders(projectId),
  })

  const { data: docsData } = useQuery({
    queryKey: ['project-files', projectId, currentFolderId],
    queryFn: () => listDocuments({
      project_id: projectId,
      folder_id: currentFolderId || 'null',
      page_size: 100,
    }),
  })

  const folders = allFolders.filter((f: Folder) => f.parent_id === currentFolderId)
  const docs = docsData?.items ?? []

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(projectId, { name, parent_id: currentFolderId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folders', projectId] }); setShowNewFolder(false); setNewFolderName('') },
  })

  const createDocMutation = useMutation({
    mutationFn: (title: string) => createDocument({ title, project_id: projectId, folder_id: currentFolderId, status: 'draft' }),
    onSuccess: (doc) => { qc.invalidateQueries({ queryKey: ['project-files'] }); setShowNewFile(false); setNewFileName(''); navigate(`/docs/${doc.id}`) },
  })

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateFolder(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folders', projectId] }); setRenamingId(null) },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders', projectId] }),
  })

  const moveDocMutation = useMutation({
    mutationFn: ({ docId, folderId }: { docId: string; folderId: string | null }) => updateDocument(docId, { folder_id: folderId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-files'] }); setMovingDocId(null) },
  })

  const enterFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id)
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }])
  }

  const goToPath = (index: number) => {
    const target = folderPath[index]
    setCurrentFolderId(target.id)
    setFolderPath(folderPath.slice(0, index + 1))
  }

  const isEmpty = folders.length === 0 && docs.length === 0 && !showNewFolder && !showNewFile

  return (
    <div className="p-4">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 text-sm min-w-0">
          {folderPath.length > 1 && (
            <button onClick={() => goToPath(folderPath.length - 2)} className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={16} />
            </button>
          )}
          {folderPath.map((p, i) => (
            <div key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={12} className="shrink-0 text-muted-foreground" />}
              <button
                onClick={() => goToPath(i)}
                className={`truncate transition-colors ${i === folderPath.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {i === 0 ? '全部文件' : p.name}
              </button>
            </div>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus size={14} /> 新建
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-border bg-card p-1 shadow-lg">
                <button
                  onClick={() => { setShowMenu(false); setShowNewFolder(true); setNewFolderName('') }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
                >
                  <FolderPlus size={14} /> 文件夹
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowNewFile(true); setNewFileName('') }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
                >
                  <FilePlus size={14} /> 文件
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content list */}
      <div className="space-y-1">
        {/* New folder input */}
        {showNewFolder && (
          <form onSubmit={(e) => { e.preventDefault(); if (newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim()) }} className="flex items-center gap-2 rounded-xl border border-primary/50 bg-card p-2.5">
            <FolderIcon size={18} className="shrink-0 text-primary" />
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="文件夹名称"
              autoFocus onBlur={() => { if (!newFolderName.trim()) setShowNewFolder(false) }}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowNewFolder(false) }}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </form>
        )}

        {/* New file input */}
        {showNewFile && (
          <form onSubmit={(e) => { e.preventDefault(); if (newFileName.trim()) createDocMutation.mutate(newFileName.trim()) }} className="flex items-center gap-2 rounded-xl border border-primary/50 bg-card p-2.5">
            <FileText size={18} className="shrink-0 text-primary" />
            <input type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="文件名称"
              autoFocus onBlur={() => { if (!newFileName.trim()) setShowNewFile(false) }}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowNewFile(false) }}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </form>
        )}

        {/* Folders */}
        {folders.map((folder: Folder) => (
          <div key={folder.id} className="group flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 hover:bg-accent/30 transition-colors">
            {renamingId === folder.id ? (
              <form onSubmit={(e) => { e.preventDefault(); if (renameValue.trim()) renameFolderMutation.mutate({ id: folder.id, name: renameValue.trim() }) }} className="flex flex-1 items-center gap-2">
                <FolderIcon size={18} className="shrink-0 text-yellow-500" />
                <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus
                  onBlur={() => setRenamingId(null)} onKeyDown={(e) => { if (e.key === 'Escape') setRenamingId(null) }}
                  className="flex-1 bg-transparent text-sm outline-none" />
              </form>
            ) : (
              <>
                <button onClick={() => enterFolder(folder)} className="flex flex-1 items-center gap-2 text-left min-w-0">
                  <FolderIcon size={18} className="shrink-0 text-yellow-500" />
                  <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                </button>
                <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
                    className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                  <button onClick={() => { if (confirm(`删除文件夹「${folder.name}」及其内容？`)) deleteFolderMutation.mutate(folder.id) }}
                    className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Documents */}
        {docs.map((doc: Document & { project_name?: string }) => (
          <div key={doc.id} className="group flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 hover:bg-accent/30 transition-colors">
            <button onClick={() => navigate(`/docs/${doc.id}?from=project&pid=${projectId}`)}
              className="flex flex-1 items-center gap-2 text-left min-w-0">
              <FileText size={18} className="shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  {parseTags(doc.tags).map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5">{t}</span>)}
                  <span>{dayjs(doc.updated_at).format('YYYY-MM-DD')}</span>
                </div>
              </div>
            </button>
            <button onClick={() => setMovingDocId(doc.id)}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              title="移动到文件夹">
              <MoveRight size={14} />
            </button>
          </div>
        ))}

        {/* Move to folder dialog */}
        {movingDocId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMovingDocId(null)} />
            <div className="relative w-72 rounded-2xl border border-border bg-card p-4 shadow-xl">
              <h3 className="text-sm font-medium mb-3">移动到</h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {currentFolderId && (
                  <button onClick={() => moveDocMutation.mutate({ docId: movingDocId, folderId: null })}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors">
                    <FolderIcon size={16} /> 根目录
                  </button>
                )}
                {allFolders
                  .filter((f: Folder) => f.id !== currentFolderId)
                  .map((f: Folder) => (
                    <button key={f.id} onClick={() => moveDocMutation.mutate({ docId: movingDocId, folderId: f.id })}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors">
                      <FolderIcon size={16} className="text-yellow-500" /> {f.name}
                    </button>
                  ))}
                {allFolders.length === 0 && !currentFolderId && (
                  <div className="text-xs text-muted-foreground px-2.5 py-2">没有可用的文件夹</div>
                )}
              </div>
              <button onClick={() => setMovingDocId(null)}
                className="mt-3 w-full rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                取消
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="py-12 text-center text-muted-foreground">
            <FolderIcon size={48} className="mx-auto mb-3 opacity-20" />
            <p>此目录为空</p>
            <p className="mt-1 text-xs">点击"新建"创建文件夹或文件</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Drawer({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      {/* Mobile: full-screen sheet from right; Desktop: centered modal */}
      <div className="relative
        w-full h-full animate-slide-left
        md:w-[480px] md:h-auto md:max-h-[85dvh] md:rounded-2xl md:animate-fade-scale
        bg-card border-border md:border overflow-y-auto">
        <div className="sticky top-0 z-10 glass flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom)+4rem)] md:pb-5">
          {children}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'

interface MilkdownEditorProps {
  defaultValue: string
  onChange?: (markdown: string) => void
}

export default function MilkdownEditor({ defaultValue, onChange }: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const onChangeRef = useRef(onChange)
  const [error, setError] = useState<string | null>(null)
  onChangeRef.current = onChange

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let destroyed = false

    const crepe = new Crepe({
      root: el,
      defaultValue,
      features: {
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
      },
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current?.(markdown)
      })
    })

    crepe.create()
      .then(() => {
        if (!destroyed) crepeRef.current = crepe
      })
      .catch((err) => {
        console.error('Milkdown init error:', err)
        setError(String(err))
      })

    return () => {
      destroyed = true
      crepe.destroy().catch(() => {})
      crepeRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="text-destructive text-sm p-4">
        <p>编辑器加载失败: {error}</p>
        <p className="mt-2 text-xs text-muted-foreground">请刷新页面重试</p>
      </div>
    )
  }

  return <div ref={containerRef} className="milkdown-editor" />
}

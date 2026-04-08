import { useEffect, useRef, useState } from 'react'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'

interface MilkdownEditorProps {
  defaultValue: string
  readonly?: boolean
  onChange?: (markdown: string) => void
}

export default function MilkdownEditor({ defaultValue, readonly = true, onChange }: MilkdownEditorProps) {
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
        [CrepeFeature.BlockEdit]: !readonly,
        [CrepeFeature.Toolbar]: !readonly,
        [CrepeFeature.Placeholder]: !readonly,
      },
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current?.(markdown)
      })
    })

    crepe.create()
      .then(() => {
        if (!destroyed) {
          crepeRef.current = crepe
          crepe.setReadonly(readonly)
        }
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
  }, [defaultValue, readonly])

  if (error) {
    return (
      <div className="text-destructive text-sm p-4">
        <p>编辑器加载失败: {error}</p>
      </div>
    )
  }

  return <div ref={containerRef} className="milkdown-wrap" />
}

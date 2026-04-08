import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'

interface MilkdownEditorProps {
  defaultValue: string
  onChange?: (markdown: string) => void
  readonly?: boolean
}

export default function MilkdownEditor({ defaultValue, onChange, readonly = false }: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue,
      features: {
        [Crepe.Feature.CodeMirror]: false,
      },
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current?.(markdown)
      })
    })

    crepe.create().then(() => {
      crepe.setReadonly(readonly)
    })

    crepeRef.current = crepe

    return () => {
      crepe.destroy()
      crepeRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (crepeRef.current) {
      crepeRef.current.setReadonly(readonly)
    }
  }, [readonly])

  return <div ref={containerRef} className="milkdown-editor" />
}

export function getMarkdownFromEditor(crepeRef: React.RefObject<Crepe | null>): string {
  return crepeRef.current?.getMarkdown() ?? ''
}

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'

export function FileDropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.wav')) onFile(file)
  }

  function handleChange(e) {
    const file = e.target.files?.[0]
    if (file) { onFile(file); e.target.value = '' }
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors',
        dragging && !disabled ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">Перетащите WAV файл</p>
        <p className="text-xs text-muted-foreground">или нажмите для выбора</p>
      </div>
      <input ref={inputRef} type="file" accept=".wav,audio/wav" className="hidden" onChange={handleChange} />
    </div>
  )
}

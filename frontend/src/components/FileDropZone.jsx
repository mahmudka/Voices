import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, CheckCircle2 } from 'lucide-react'

export function FileDropZone({ onFile, disabled, hasFile }) {
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
        'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-7',
        'cursor-pointer select-none transition-all duration-200 ease-out',
        dragging && !disabled
          ? 'border-primary bg-primary/8 scale-[1.01]'
          : hasFile
            ? 'border-[hsl(var(--success)/0.6)] bg-[hsl(var(--success)/0.05)]'
            : 'border-border hover:border-primary/50 hover:bg-muted/40',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className={cn(
        'rounded-full p-2 transition-all duration-200',
        hasFile ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' : 'bg-muted text-muted-foreground',
        dragging && !disabled && 'bg-primary/15 text-primary scale-110',
      )}>
        {hasFile
          ? <CheckCircle2 className="h-6 w-6" />
          : <Upload className="h-6 w-6" />
        }
      </div>

      <div className="text-center">
        <p className="text-sm font-medium">
          {hasFile ? 'Файл загружен' : 'Перетащите WAV файл'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasFile ? 'нажмите для замены' : 'или нажмите для выбора'}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".wav,audio/wav"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}

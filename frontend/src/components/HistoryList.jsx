import { Trash2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HistoryList({ items, onDelete, onDeleteAll, onSelect }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">История пуста</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{items.length} записей</span>
        <Button size="sm" variant="ghost" onClick={onDeleteAll}
          className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-1" />Очистить всё
        </Button>
      </div>

      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {items.map(item => (
          <div key={item.id}
            className="flex items-center gap-2 rounded-md border dark:border-white/8 px-3 py-2 hover:bg-muted/40 group">
            <button className="flex-1 text-left min-w-0" onClick={() => onSelect(item)}>
              {item.inputText
                ? <p className="text-sm font-medium truncate">{item.inputText}</p>
                : <p className="text-sm font-medium truncate text-muted-foreground">{item.inputFile}</p>
              }
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {item.voiceId ?? '—'}
              </p>
            </button>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.outputFile && (
                <button onClick={() => onSelect(item)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="Загрузить в плеер">
                  <Play className="h-3.5 w-3.5" />
                </button>
              )}
              <Button size="icon" variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

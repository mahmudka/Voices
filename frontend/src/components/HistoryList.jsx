import { Trash2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { audioUrl } from '@/lib/api'

const VOICE_LABELS = { male: 'Муж.', female: 'Жен.', child: 'Дет.' }
const TIMBRE_LABELS = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }

export function HistoryList({ items, onDelete, onDeleteAll, onSelect }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">История пуста</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{items.length} записей</span>
        <Button size="sm" variant="ghost" onClick={onDeleteAll} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Очистить всё
        </Button>
      </div>

      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 group"
          >
            <button
              className="flex-1 text-left min-w-0"
              onClick={() => onSelect(item)}
            >
              <p className="text-sm font-medium truncate">{item.inputFile}</p>
              <div className="flex gap-1 mt-0.5">
                <Badge variant="secondary">{VOICE_LABELS[item.voiceType] ?? item.voiceType}</Badge>
                <Badge variant="secondary">{item.age} лет</Badge>
                <Badge variant="secondary">{TIMBRE_LABELS[item.timbre] ?? item.timbre}</Badge>
              </div>
            </button>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.outputFile && (
                <button
                  onClick={() => onSelect(item)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm transition-all duration-150 active:scale-[0.96] hover:bg-accent hover:text-accent-foreground"
                  title="Загрузить в плеер"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

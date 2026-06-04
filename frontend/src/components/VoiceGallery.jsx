import { cn } from '@/lib/utils'

const GENDER_STYLE = {
  male:   { ring: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  female: { ring: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  child:  { ring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
}

export function VoiceGallery({ voices, selectedId, onSelect, disabled }) {
  if (!voices || voices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Загрузка голосов...
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {voices.map(voice => {
        const style = GENDER_STYLE[voice.gender] ?? GENDER_STYLE.male
        const isSelected = selectedId === voice.voiceId

        return (
          <button
            key={voice.voiceId}
            onClick={() => !disabled && onSelect(voice)}
            disabled={disabled}
            className={cn(
              'group relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left',
              'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            {/* Icon circle */}
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full text-base font-bold',
              style.ring,
            )}>
              {voice.icon}
            </div>

            {/* Text */}
            <div className="min-w-0">
              <p className={cn(
                'text-sm font-semibold leading-tight truncate',
                isSelected ? 'text-primary' : 'text-foreground',
              )}>
                {voice.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-tight line-clamp-2">
                {voice.description}
              </p>
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        )
      })}
    </div>
  )
}

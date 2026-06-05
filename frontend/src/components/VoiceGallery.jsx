import { cn } from '@/lib/utils'

const GENDER = {
  male: {
    bg:   'bg-cyan-500/10 dark:bg-cyan-400/8',
    text: 'text-cyan-600 dark:text-cyan-400',
    glow: 'glow-blue',
    ring: 'border-cyan-400/70',
    dot:  'bg-cyan-400',
  },
  female: {
    bg:   'bg-rose-500/10 dark:bg-rose-400/8',
    text: 'text-rose-600 dark:text-rose-400',
    glow: 'glow-rose',
    ring: 'border-rose-400/70',
    dot:  'bg-rose-400',
  },
  child: {
    bg:   'bg-amber-500/10 dark:bg-amber-400/8',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'glow-amber',
    ring: 'border-amber-400/70',
    dot:  'bg-amber-400',
  },
}

export function VoiceGallery({ voices, selectedId, onSelect, disabled }) {
  if (!voices || voices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3 text-center animate-fade-in-up">
        Загрузка голосов...
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {voices.map(voice => {
        const g        = GENDER[voice.gender] ?? GENDER.male
        const selected = selectedId === voice.voiceId

        return (
          <button
            key={voice.voiceId}
            onClick={() => !disabled && onSelect(voice)}
            disabled={disabled}
            className={cn(
              'group relative flex flex-col items-start gap-2.5 rounded-xl border-2 p-3.5 text-left',
              'transition-all duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'active:scale-[0.97]',
              selected
                ? [g.ring, 'bg-primary/5', g.glow, 'scale-[1.02]']
                : [
                    'border-border dark:border-white/6',
                    'bg-card',
                    'hover:border-opacity-60',
                    voice.gender === 'male'   && 'hover:border-cyan-400/40  hover:glow-blue',
                    voice.gender === 'female' && 'hover:border-rose-400/40  hover:glow-rose',
                    voice.gender === 'child'  && 'hover:border-amber-400/40 hover:glow-amber',
                  ],
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            {/* Avatar icon */}
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full text-base font-bold',
              'transition-transform duration-200',
              selected ? 'scale-110' : 'group-hover:scale-105',
              g.bg, g.text,
            )}>
              {voice.icon}
            </div>

            {/* Name + description */}
            <div className="min-w-0">
              <p className={cn(
                'text-sm font-semibold leading-tight truncate transition-colors duration-150',
                selected ? g.text : 'text-foreground',
              )}>
                {voice.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-tight line-clamp-2">
                {voice.description}
              </p>
            </div>

            {/* Selected indicator */}
            {selected && (
              <span className={cn(
                'absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full animate-scale-in',
                g.dot,
              )} />
            )}
          </button>
        )
      })}
    </div>
  )
}

import { cn } from '@/lib/utils'

const LANG_LABELS = {
  'ru-RU': 'Русский',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'es-ES': 'Español',
}

const GENDER_STYLE = {
  male:   { dot: 'bg-cyan-400',  text: 'text-cyan-400',  ring: 'border-cyan-400/70',  glow: 'glow-blue' },
  female: { dot: 'bg-rose-400',  text: 'text-rose-400',  ring: 'border-rose-400/70',  glow: 'glow-rose' },
}

function groupByLanguage(voices) {
  const map = {}
  for (const v of voices) {
    const lang = v.language || 'other'
    if (!map[lang]) map[lang] = []
    map[lang].push(v)
  }
  return map
}

export function VoiceGallery({ voices, selectedId, onSelect, disabled }) {
  if (!voices || voices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3 text-center animate-fade-in-up">
        Загрузка голосов...
      </p>
    )
  }

  const groups = groupByLanguage(voices)

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([lang, group]) => (
        <div key={lang}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
            {LANG_LABELS[lang] ?? lang}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {group.map(voice => {
              const g        = GENDER_STYLE[voice.gender] ?? GENDER_STYLE.male
              const selected = selectedId === voice.voiceId
              return (
                <button
                  key={voice.voiceId}
                  onClick={() => !disabled && onSelect(voice)}
                  disabled={disabled}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left',
                    'transition-all duration-200 ease-out active:scale-[0.97]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? [g.ring, 'bg-primary/5', g.glow, 'scale-[1.02]']
                      : ['border-border dark:border-white/6 bg-card',
                         voice.gender === 'male'   && 'hover:border-cyan-400/40 hover:glow-blue',
                         voice.gender === 'female' && 'hover:border-rose-400/40 hover:glow-rose',
                        ],
                    disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  {/* Gender dot */}
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', g.dot)} />

                  {/* Name */}
                  <span className={cn(
                    'text-sm font-medium truncate',
                    selected ? g.text : 'text-foreground',
                  )}>
                    {voice.name}
                  </span>

                  {selected && (
                    <span className={cn(
                      'ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 animate-scale-in',
                      g.dot,
                    )} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

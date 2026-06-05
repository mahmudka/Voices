import { useState, useRef } from 'react'
import { Volume2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

const LANG_ORDER  = ['ru-RU', 'ro-RO', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES']
const LANG_LABELS = {
  'ru-RU': 'Русский',
  'ro-RO': 'Română',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'es-ES': 'Español',
}

const GENDER_STYLE = {
  male:   { dot: 'bg-cyan-400', text: 'text-cyan-400', ring: 'border-cyan-400/70' },
  female: { dot: 'bg-rose-400', text: 'text-rose-400', ring: 'border-rose-400/70' },
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
  const [previewingId, setPreviewingId] = useState(null)
  const audioRef = useRef(null)

  function handlePreview(e, voiceId) {
    e.stopPropagation()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current = null
    }
    if (previewingId === voiceId) {
      setPreviewingId(null)
      return
    }
    const audio = new Audio(`/samples/${voiceId}.mp3`)
    audioRef.current = audio
    setPreviewingId(voiceId)
    audio.play().catch(() => setPreviewingId(null))
    audio.onended = () => { setPreviewingId(null); audioRef.current = null }
  }

  if (!voices || voices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3 text-center animate-fade-in-up">
        Загрузка голосов...
      </p>
    )
  }

  const groups = groupByLanguage(voices)
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    const ia = LANG_ORDER.indexOf(a)
    const ib = LANG_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  return (
    <div className="space-y-4">
      {sortedGroups.map(([lang, group]) => (
        <div key={lang}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
            {LANG_LABELS[lang] ?? lang}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {group.map(voice => {
              const g          = GENDER_STYLE[voice.gender] ?? GENDER_STYLE.male
              const selected   = selectedId === voice.voiceId
              const previewing = previewingId === voice.voiceId
              return (
                <button
                  key={voice.voiceId}
                  onClick={() => !disabled && onSelect(voice)}
                  disabled={disabled}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left',
                    'transition-all duration-200 ease-out active:scale-[0.97]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? [g.ring, 'bg-primary/5', 'scale-[1.02]']
                      : ['border-border dark:border-white/6 bg-card',
                         voice.gender === 'male'   && 'hover:border-cyan-400/40',
                         voice.gender === 'female' && 'hover:border-rose-400/40',
                        ],
                    disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', g.dot)} />
                  <span className={cn(
                    'text-sm font-medium truncate flex-1',
                    selected ? g.text : 'text-foreground',
                  )}>
                    {voice.name}
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={e => handlePreview(e, voice.voiceId)}
                    title="Прослушать"
                    className={cn(
                      'flex-shrink-0 flex items-center justify-center h-5 w-5 rounded',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
                      previewing && 'opacity-100',
                      previewing ? 'text-amber-400' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {previewing
                      ? <Square className="h-3 w-3 fill-current animate-pulse" />
                      : <Volume2 className="h-3 w-3" />
                    }
                  </span>
                  {selected && (
                    <span className={cn('ml-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0 animate-scale-in', g.dot)} />
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

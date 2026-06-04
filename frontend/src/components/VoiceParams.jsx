import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const VOICE_TYPES = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'child', label: 'Детский' },
]

const TIMBRES = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
]

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function VoiceParams({ params, onChange, disabled }) {
  const minAge = params.voiceType === 'child' ? 5 : 18
  const maxAge = params.voiceType === 'child' ? 17 : 80

  function set(key, val) {
    if (disabled) return
    const next = { ...params, [key]: val }
    if (key === 'voiceType') {
      if (val === 'child') next.age = Math.min(next.age, 17)
      else next.age = Math.max(next.age, 18)
    }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Голос</label>
        <ToggleGroup options={VOICE_TYPES} value={params.voiceType} onChange={v => set('voiceType', v)} />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <label className="text-sm font-medium">Возраст</label>
          <span className="text-sm text-muted-foreground">{params.age} лет</span>
        </div>
        <Slider
          min={minAge}
          max={maxAge}
          value={params.age}
          onValueChange={v => set('age', v)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Тембр</label>
        <ToggleGroup options={TIMBRES} value={params.timbre} onChange={v => set('timbre', v)} />
      </div>
    </div>
  )
}

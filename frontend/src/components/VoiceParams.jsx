import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const TIMBRES = [
  { value: 'low',    label: 'Низкий',  cls: 'font-bold tracking-tight' },
  { value: 'medium', label: 'Средний', cls: 'font-normal' },
  { value: 'high',   label: 'Высокий', cls: 'font-light tracking-wide' },
]

function ageCategory(age) {
  if (age <= 12) return 'Ребёнок'
  if (age <= 17) return 'Подросток'
  if (age <= 30) return 'Молодой'
  if (age <= 50) return 'Взрослый'
  if (age <= 65) return 'Зрелый'
  return 'Пожилой'
}

export function VoiceParams({ params, onChange, disabled, ageMin = 5, ageMax = 80 }) {
  function set(key, val) {
    if (disabled) return
    onChange({ ...params, [key]: val })
  }

  const clampedAge = Math.min(ageMax, Math.max(ageMin, params.age))

  return (
    <div className="space-y-5">

      {/* Age slider */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-medium">Возраст</label>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums leading-none">
              {clampedAge}
            </span>
            <span className="text-xs text-muted-foreground">лет</span>
          </div>
        </div>

        <Slider
          min={ageMin}
          max={ageMax}
          value={clampedAge}
          onValueChange={v => set('age', v)}
          disabled={disabled}
        />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{ageMin}</span>
          <span className="font-medium text-foreground">{ageCategory(clampedAge)}</span>
          <span>{ageMax}</span>
        </div>
      </div>

      {/* Timbre */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Тембр</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TIMBRES.map(t => (
            <button
              key={t.value}
              onClick={() => set('timbre', t.value)}
              disabled={disabled}
              className={cn(
                'rounded-lg border-2 py-2.5 text-sm transition-all duration-150',
                t.cls,
                params.timbre === t.value
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/60',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

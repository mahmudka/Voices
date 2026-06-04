import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const TIMBRES = [
  { value: 'low',    label: 'Низкий',  cls: 'font-bold tracking-tight text-[0.8rem]' },
  { value: 'medium', label: 'Средний', cls: 'font-normal text-[0.85rem]' },
  { value: 'high',   label: 'Высокий', cls: 'font-light tracking-wide text-[0.9rem]' },
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

  const age = Math.min(ageMax, Math.max(ageMin, params.age))

  return (
    <div className="space-y-5">

      {/* Age */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-medium">Возраст</label>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums leading-none transition-all duration-150">
              {age}
            </span>
            <span className="text-xs text-muted-foreground">лет</span>
          </div>
        </div>

        <Slider
          min={ageMin}
          max={ageMax}
          value={age}
          onValueChange={v => set('age', v)}
          disabled={disabled}
        />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{ageMin}</span>
          <span className="font-medium text-foreground animate-fade-in-up" key={ageCategory(age)}>
            {ageCategory(age)}
          </span>
          <span>{ageMax}</span>
        </div>
      </div>

      {/* Timbre */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Тембр</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TIMBRES.map(t => {
            const active = params.timbre === t.value
            return (
              <button
                key={t.value}
                onClick={() => set('timbre', t.value)}
                disabled={disabled}
                className={cn(
                  'rounded-lg border-2 py-2.5 transition-all duration-150 ease-out',
                  'active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  t.cls,
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm scale-[1.02]'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/60',
                  disabled && 'pointer-events-none opacity-50',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}

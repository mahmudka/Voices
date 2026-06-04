import { cn } from '@/lib/utils'

export function Slider({ value, min = 0, max = 100, step = 1, onValueChange, className, ...props }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onValueChange?.(Number(e.target.value))}
      className={cn(
        'w-full h-2 appearance-none rounded-full bg-secondary cursor-pointer',
        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
        className
      )}
      {...props}
    />
  )
}

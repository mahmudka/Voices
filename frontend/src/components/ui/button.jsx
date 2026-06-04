import { cn } from '@/lib/utils'

const variants = {
  default:     'bg-primary text-primary-foreground hover:bg-primary/85 active:bg-primary/75',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/85 active:bg-destructive/75',
  outline:     'border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/70',
  secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary/60',
  ghost:       'hover:bg-accent hover:text-accent-foreground active:bg-accent/70',
  success:     'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success)/0.85)]',
}

const sizes = {
  default: 'h-10 px-4 py-2',
  sm:      'h-9 rounded-md px-3 text-sm',
  lg:      'h-11 rounded-md px-8 text-base',
  icon:    'h-10 w-10',
}

export function Button({ className, variant = 'default', size = 'default', disabled, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
        'transition-all duration-150 ease-out',
        'active:scale-[0.96]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50',
        'select-none',
        variants[variant] ?? variants.default,
        sizes[size]   ?? sizes.default,
        className,
      )}
      disabled={disabled}
      {...props}
    />
  )
}

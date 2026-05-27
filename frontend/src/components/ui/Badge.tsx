import clsx from 'clsx'

const variants = {
  positive: 'bg-green-900/50 text-green-400 border-green-800',
  negative: 'bg-red-900/50 text-red-400 border-red-800',
  neutral:  'bg-gray-800 text-gray-400 border-gray-700',
}

interface BadgeProps {
  variant: keyof typeof variants
  children: React.ReactNode
}

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-md text-xs font-medium border', variants[variant])}>
      {children}
    </span>
  )
}

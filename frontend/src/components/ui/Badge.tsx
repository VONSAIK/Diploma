import clsx from 'clsx'

const variants = {
  positive: 'bg-[#0f2a1a] text-[#4ade80] border-[#1a4a2a]',
  negative: 'bg-[#2a0f0f] text-[#f87171] border-[#4a1a1a]',
  neutral:  'bg-[#1a1a1a] text-[#666666] border-[#2a2a2a]',
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

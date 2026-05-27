import { ReactNode } from 'react'
import clsx from 'clsx'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
}

export default function Card({ title, children, className }: CardProps) {
  return (
    <div className={clsx('bg-gray-900 border border-gray-800 rounded-xl p-5', className)}>
      {title && <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>}
      {children}
    </div>
  )
}

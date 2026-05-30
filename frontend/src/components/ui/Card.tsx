import { ReactNode } from 'react'
import clsx from 'clsx'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
}

export default function Card({ title, children, className }: CardProps) {
  return (
    <div className={clsx('bg-[#111111] border border-[#1e1e1e] rounded-xl p-5', className)}>
      {title && (
        <h2 className="text-[11px] font-semibold text-[#444444] uppercase tracking-widest mb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}

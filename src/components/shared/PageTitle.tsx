import type { ReactNode } from 'react'

type PageTitleProps = {
  children: ReactNode
  className?: string
}

/**
 * Sole entry point for IBM Plex Serif. Do not use font-serif / font-display
 * utilities elsewhere — serif at UI size on this dark palette is a bug.
 */
export default function PageTitle({ children, className }: PageTitleProps) {
  return (
    <h1
      className={
        className
          ? `page-title max-w-full ${className}`
          : 'page-title max-w-full'
      }
    >
      {children}
    </h1>
  )
}

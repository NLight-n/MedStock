'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import Header from './Header'

export default function LayoutWithConditionalHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideHeader = pathname === '/login' || pathname === '/setup'
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!hideHeader && <Header />}
      <main>{children}</main>
    </div>
  )
} 
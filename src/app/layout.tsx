import type { Metadata } from 'next'
import './globals.css'
import { PosthogProvider } from '@/components/providers/PosthogProvider'

export const metadata: Metadata = {
  title: 'Stride Dash',
  description: '3 jobs, curated for you. Not 300.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <PosthogProvider>
          {children}
        </PosthogProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PosthogProvider } from '@/components/providers/PosthogProvider'

const inter = Inter({ subsets: ['latin'], weight: ['300','400','500','600','700','800','900'] })

export const metadata: Metadata = {
  title: 'Stride Dash',
  description: '3 jobs, curated for you. Not 300.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PosthogProvider>
          {children}
        </PosthogProvider>
      </body>
    </html>
  )
}

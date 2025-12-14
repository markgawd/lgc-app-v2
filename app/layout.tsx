import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LGC - Lazy Gains Club',
  description: 'Track your strength-to-leanness journey',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-md mx-auto min-h-screen pb-24">
          {children}
        </div>
      </body>
    </html>
  )
}

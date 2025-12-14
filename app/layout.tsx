import './globals.css'

export const metadata = {
  title: 'LGC - Lazy Gains Club',
  description: 'Track your strength-to-leanness journey',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-md mx-auto min-h-screen">{children}</div>
      </body>
    </html>
  )
}

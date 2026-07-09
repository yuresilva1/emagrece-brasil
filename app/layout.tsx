import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FitPlanner — Planejador de Alimentação Fit',
  description: 'Gere seu plano alimentar personalizado para 5, 10 ou 20 dias com receitas fit e sucos detox.',
  keywords: ['plano alimentar', 'receitas fit', 'suco detox', 'emagrecer', 'alimentação saudável'],
  authors: [{ name: 'FitPlanner' }],
  robots: 'index, follow',
  openGraph: {
    title: 'FitPlanner — Seu Plano Alimentar Personalizado',
    description: 'Receitas fit + sucos detox. Gere seu plano para 5, 10 ou 20 dias.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0f1a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';
import { ThemeProvider } from '@/lib/theme';

const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-urbanist' });

export const metadata: Metadata = {
  title: 'Entrena',
  description: 'Registra tus entrenos, ve tu progreso',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Entrena',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark">
      <head>
        <meta name="theme-color" content="#0c0e14" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${urbanist.variable} font-[family-name:var(--font-urbanist)] min-h-screen`}>
        <ThemeProvider>
          <ServiceWorker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

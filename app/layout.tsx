import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

const inter = Inter({ subsets: ['latin'] });

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#0f1117" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}

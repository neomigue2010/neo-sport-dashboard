import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Neo Sport Dashboard',
  description: 'MVP visual mobile-first para seguimiento de entrenamientos con calendario, sesiones y progresión.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

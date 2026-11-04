import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'INNOVA SYNAPSE — Escritura científica', description: 'Editor de investigación científica con LaTeX, PDF e inteligencia artificial.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>;
}

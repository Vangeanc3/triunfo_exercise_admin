import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Triunfo Exercise Admin',
  description: 'Admin para configurar exercícios do Triunfo.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

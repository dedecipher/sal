import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SSAL',
  description: 'Solana Secure Agent Layer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script src="/ggwave/ggwave.js" strategy="beforeInteractive" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
} 
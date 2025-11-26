import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | SEO Tools',
    default: 'SEO Analysis Tools',
  },
  description: 'Powerful tools to analyze, optimize, and improve your search engine performance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

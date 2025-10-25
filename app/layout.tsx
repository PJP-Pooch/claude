import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Query Fan Out Analysis',
  description: 'Analyze SERP results to discover content opportunities and identify cannibalization issues.',
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

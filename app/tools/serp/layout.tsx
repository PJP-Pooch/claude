import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Query Fan Out Analysis',
    description: 'Analyze SERP results to discover content opportunities and identify cannibalization issues using AI-powered query fan-out and SERP-similarity clustering.',
};

export default function SerpToolLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Social SERP Explorer',
    description: 'Fetch Reddit, Pinterest, Instagram, TikTok, and YouTube results for your keyword via DataForSEO, and export them to Excel.',
};

export default function SocialSerpLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}

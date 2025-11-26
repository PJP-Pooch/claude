import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Seasonal Content Planner',
    description: 'Analyze historical search trends, forecast future demand, and plan your content calendar with seasonality insights.',
};

export default function SeasonalityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}

import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://searchdatatrends.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Golf Search Trends Dashboard — Google Trends Data for Golf Equipment (2017–2026)',
  description:
    'Live dashboard tracking Google Trends search volume for golf clubs, golf balls, golf bags, golf simulators, and overall golf interest in the US. Updated daily with annual, quarterly, and monthly visualizations. Pre-pandemic vs. post-pandemic analysis included.',
  keywords: [
    'golf trends',
    'golf search volume',
    'golf clubs trends',
    'golf equipment demand',
    'golf industry data',
    'golf simulator trends',
    'google trends golf',
    'golf participation statistics',
    'golf market analysis',
    'golf seasonal trends',
  ],
  authors: [{ name: 'Golf Trends Dashboard' }],
  openGraph: {
    title: 'Golf Search Trends Dashboard — Live Google Trends Data',
    description:
      'Six interactive charts tracking US golf search interest from 2017 to present. Equipment demand, seasonal patterns, simulator growth, and year-over-year analysis. Updated daily.',
    url: siteUrl,
    siteName: 'Golf Search Trends Dashboard',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Golf Search Trends Dashboard',
    description:
      'Live Google Trends data for golf equipment. Annual, quarterly, monthly, and seasonal analysis from 2017–2026.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Golf Search Trends Dashboard',
  url: siteUrl,
  description:
    'Live dashboard tracking Google Trends search volume for golf-related terms in the US from 2017 to present. Six interactive visualizations covering annual trends, quarterly breakdowns, equipment demand, simulator seasonality, and year-over-year analysis.',
  applicationCategory: 'Data Visualization',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  creator: {
    '@type': 'Organization',
    name: 'Golf Trends Dashboard',
  },
  about: [
    {
      '@type': 'Dataset',
      name: 'US Golf Search Volume Trends',
      description:
        'Normalized Google Trends search interest (0–100 scale) for six golf-related terms: golf clubs, golf balls, golf bags, golf, golf equipment, golf simulator. US geography, monthly granularity, 2017–present.',
      temporalCoverage: '2017/..',
      spatialCoverage: {
        '@type': 'Place',
        name: 'United States',
      },
      variableMeasured: [
        'Google Trends normalized search interest for "golf clubs"',
        'Google Trends normalized search interest for "golf balls"',
        'Google Trends normalized search interest for "golf bags"',
        'Google Trends normalized search interest for "golf"',
        'Google Trends normalized search interest for "golf equipment"',
        'Google Trends normalized search interest for "golf simulator"',
      ],
      distribution: {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${siteUrl}/api/data`,
      },
      license: 'https://creativecommons.org/licenses/by/4.0/',
      measurementTechnique:
        'Google Trends normalized index (0–100). Weekly data aggregated to monthly by averaging data points within each calendar month.',
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,600;1,300&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

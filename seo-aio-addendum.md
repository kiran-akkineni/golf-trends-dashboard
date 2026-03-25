# SEO & AIO Optimization Addendum

Append this section to your main build prompt. Everything here is additive — it doesn't replace any existing spec, it extends it.

---

## New Files to Add

```
/
├── public/
│   ├── llms.txt              # AI/LLM discoverability (concise)
│   ├── llms-full.txt         # AI/LLM discoverability (detailed)
│   ├── robots.txt            # Search engine crawling rules
│   └── favicon.svg           # (already specified)
├── app/
│   ├── sitemap.ts            # Dynamic sitemap generation
│   ├── layout.tsx            # ← UPDATED with structured data + meta
│   └── page.tsx              # ← UPDATED with semantic HTML
```

---

## 1. llms.txt and llms-full.txt

These files are the AI-search equivalent of robots.txt. They tell LLMs and AI search systems (Perplexity, ChatGPT browse, Claude search, Google AI Overviews) what your site is, what data it contains, and how to cite it. Place both in `/public/` so they're served at the root.

**`/public/llms.txt`** — Concise version (~2KB). Contains: site description, key findings summary, methodology overview, section descriptions, API endpoint documentation, terms-tracked table.

**`/public/llms-full.txt`** — Detailed version (~6KB). Contains everything above plus: detailed analysis narratives, confirmed data points table, full API response schema, technical stack summary, caveats and limitations.

Both files are provided separately. Copy them into `/public/` as-is.

### Why two files?
AI systems have varying context budgets. The concise version fits easily in a single retrieval chunk. The full version gives complete context when the system can handle it. The `llms.txt` spec recommends linking to the full version from the concise one — add this line at the bottom of `llms.txt`:

```
## Full Documentation
- [Complete context and data details](/llms-full.txt)
```

---

## 2. Meta Tags & Open Graph (update layout.tsx)

Add this metadata export to `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://golftrends.example.com'

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
    // Add an OG image — see section 6 below
    // images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Golf Search Trends Dashboard',
    description:
      'Live Google Trends data for golf equipment. Annual, quarterly, monthly, and seasonal analysis from 2017–2026.',
    // images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
}
```

---

## 3. Structured Data (JSON-LD)

Add a `<script type="application/ld+json">` block in `layout.tsx` (inside the `<head>` via Next.js metadata, or as a component in the body). This gives Google and AI systems machine-readable context about what the page is.

```typescript
// In layout.tsx, add inside the <body> or via generateMetadata:
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
  dateModified: new Date().toISOString(),
}

// Render in layout:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

### Why `Dataset` schema?
Google's AI Overviews and Dataset Search both use the `Dataset` schema to understand structured data sources. This makes it more likely your dashboard gets cited when someone asks an AI "what are the trends in golf equipment search volume?" or "is golf growing in popularity?"

---

## 4. Semantic HTML (update page.tsx and components)

The current spec focuses on visual design but doesn't specify semantic elements. For SEO, the rendered HTML matters. Apply these changes:

### Page-level
- Wrap the masthead in a `<header>` with `role="banner"`
- Wrap the 6 chart sections in `<main>`
- Wrap the methodology footnotes in a `<footer>`
- Each chart section is an `<article>` (self-contained unit of content) or `<section>` with an `aria-labelledby` pointing to its heading

### Section headings
The section labels ("01 — Long-Run Trend", etc.) are currently styled spans. Make them actual `<h2>` elements so crawlers see a heading hierarchy:

```html
<header role="banner">
  <h1>Golf Search Volume / <strong>Time Series</strong></h1>
  <p>Tracking US search interest for golf equipment, participation, and simulator demand.</p>
</header>

<main>
  <section aria-labelledby="section-01">
    <h2 id="section-01">01 — Long-Run Trend</h2>
    <!-- chart card -->
  </section>

  <section aria-labelledby="section-02">
    <h2 id="section-02">02 — Quarterly Granularity</h2>
    <!-- chart card -->
  </section>

  <!-- ... sections 03–06 ... -->
</main>

<footer>
  <h2 class="sr-only">Methodology</h2>
  <p>Google Trends reports normalized search interest on a 0–100 scale...</p>
</footer>
```

The `<h2>` elements can keep their current mono/uppercase styling — visual presentation doesn't need to match heading level. But the DOM hierarchy matters for crawlers.

### Chart cards
Each `<ChartCard>` should render a `<figure>` with a `<figcaption>`:

```html
<figure>
  <figcaption>Annual average Google Trends interest for "golf clubs" (2017–2026)</figcaption>
  <canvas id="chart-annual" aria-label="Bar chart of annual golf clubs search interest"></canvas>
</figure>
```

### Heatmap
The heatmap is already DOM-rendered (not canvas), which is great for SEO. Add a `<table>` element with proper `<thead>`/`<tbody>`, `<th scope="col">` for months, `<th scope="row">` for years. This makes the heatmap data crawlable:

```html
<table aria-label="Monthly search interest heatmap for golf clubs, 2017–2026">
  <thead>
    <tr>
      <th scope="col">Year</th>
      <th scope="col">Jan</th>
      <th scope="col">Feb</th>
      <!-- ... -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">2017</th>
      <td style="background:#0a1c10">32</td>
      <!-- ... -->
    </tr>
  </tbody>
</table>
```

---

## 5. Sitemap (app/sitemap.ts)

Next.js App Router supports dynamic sitemaps via `app/sitemap.ts`. This auto-generates `/sitemap.xml`:

```typescript
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://golftrends.example.com'
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]
}
```

It's a single-page app, so the sitemap is simple. The `lastModified: new Date()` ensures crawlers know the page updates daily.

---

## 6. OG Image

Generate a static OG image or use Next.js `opengraph-image.tsx` to dynamically render one. Recommended approach:

```
app/
  opengraph-image.tsx   # Uses @vercel/og (ImageResponse) to render a 1200×630 card
```

The image should show: the site title, a simplified version of Chart 1 (annual bars), and the tagline. Use the same dark theme and green/gold colors. This is what shows up in social shares, Slack unfurls, and some AI search results.

---

## 7. robots.txt

Place in `/public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /api/refresh
Allow: /api/data

Sitemap: https://golftrends.example.com/sitemap.xml
```

The `/api/refresh` endpoint is protected and should not be crawled. The `/api/data` endpoint is public and can be indexed — AI systems may fetch it directly.

---

## 8. Content Strategy for AIO

AI Overviews and AI search engines extract answers from pages with clear, authoritative, well-structured prose. The current spec is chart-heavy with minimal body text. Add these **prose blocks** between chart sections — they serve double duty as on-page content for crawlers and contextual reading for human visitors:

### After Chart 1 (Long-Run Annual):
> **What the data shows:** Golf search interest in the US peaked in 2021, driven by the pandemic-era surge in outdoor recreation. The annual average for "golf clubs" hit [computed value] — roughly [X]% above the 2017–2019 baseline. Since 2022, interest has stabilized at a "new normal" approximately 29% higher than pre-pandemic levels, suggesting the golf boom left lasting participation gains rather than a temporary spike.

### After Chart 3 (Monthly Equipment):
> **Equipment seasonality:** Golf equipment search follows a predictable annual cycle. Interest bottoms out in December through February, ramps sharply in March and April as the season opens, and peaks between May and August. "Golf clubs" consistently leads in volume, followed by "golf balls" at roughly half the index value. "Golf bags" shows the lowest baseline but a distinctive November spike tied to holiday gift shopping.

### After Chart 4 (Simulator vs. Clubs):
> **Two consumer windows:** The inverse seasonality between "golf clubs" and "golf simulator" reveals two distinct buying cycles. Equipment search dominates the warm months (May–August), while simulator interest peaks in the off-season (November–February). Simulator search has also shown structural growth of approximately 8% annually from 2019 to 2023, reflecting expanding adoption of indoor golf technology. The launch of the TGL simulator league in January 2025 further elevated off-season interest.

These paragraphs directly answer the kinds of questions AI systems field: "Is golf growing?" "When do people search for golf equipment?" "Are golf simulators becoming more popular?" By having clear, factual prose on the page, you become a citable source.

---

## 9. Environment Variable Addition

```bash
# .env.local (add to existing)
NEXT_PUBLIC_SITE_URL=https://golftrends.example.com  # Used by sitemap, OG tags, canonical URL
```

---

## 10. Updated File Structure

```
/
├── app/
│   ├── page.tsx                  # ← Add semantic HTML (header/main/footer/article)
│   ├── layout.tsx                # ← Add metadata export + JSON-LD script
│   ├── sitemap.ts                # NEW — dynamic sitemap
│   ├── opengraph-image.tsx       # NEW — dynamic OG image (optional)
│   ├── api/
│   │   ├── refresh/route.ts
│   │   └── data/route.ts
├── components/
│   ├── Dashboard.tsx             # ← Add prose blocks between chart sections
│   ├── ChartCard.tsx             # ← Render as <figure> with <figcaption>
│   ├── Heatmap.tsx               # ← Use <table> with proper <th> scoping
│   └── ...
├── public/
│   ├── llms.txt                  # NEW — AI discoverability (concise)
│   ├── llms-full.txt             # NEW — AI discoverability (detailed)
│   ├── robots.txt                # NEW — crawler rules
│   └── favicon.svg
└── ...
```

---

## Acceptance Criteria (SEO/AIO additions)

- [ ] `/llms.txt` serves correctly at root, contains site description + key findings + methodology + API docs
- [ ] `/llms-full.txt` serves correctly, contains full analysis narratives + data points + schema
- [ ] `/robots.txt` allows `/` and `/api/data`, disallows `/api/refresh`
- [ ] `/sitemap.xml` auto-generated by Next.js, contains root URL with `changeFrequency: daily`
- [ ] `<head>` contains: title, description, OG tags, Twitter card tags, canonical URL
- [ ] JSON-LD `Dataset` schema present in page source, validates at schema.org validator
- [ ] Heading hierarchy: single `<h1>`, section `<h2>`s for each chart section, methodology footer
- [ ] Heatmap renders as semantic `<table>` with `<th scope>` attributes
- [ ] Chart canvases have `aria-label` attributes
- [ ] At least 3 prose paragraphs on the page (not just chart footnotes) answering common queries
- [ ] OG image renders at 1200×630 with site branding (if implementing dynamic OG)

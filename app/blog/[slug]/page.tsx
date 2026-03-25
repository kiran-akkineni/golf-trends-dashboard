import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllSlugs, getPost, markdownToHtml } from '@/lib/blog';
import '../blog.css';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: 'Not Found' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://golf.searchdatatrends.com';

  return {
    title: `${post.title} — Golf Search Trends Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: `${post.date}T12:00:00Z`,
      url: `${siteUrl}/blog/${slug}`,
      tags: post.tags,
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: `${siteUrl}/blog/${slug}`,
    },
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const htmlContent = markdownToHtml(post.content);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://golf.searchdatatrends.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: `${post.date}T12:00:00Z`,
    dateModified: `${post.date}T12:00:00Z`,
    url: `${siteUrl}/blog/${slug}`,
    author: {
      '@type': 'Organization',
      name: 'Golf Search Trends Dashboard',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Search Data Trends',
      url: 'https://searchdatatrends.com',
    },
    mainEntityOfPage: `${siteUrl}/blog/${slug}`,
    keywords: post.tags.join(', '),
    isPartOf: {
      '@type': 'Blog',
      name: 'Golf Search Trends Blog',
      url: `${siteUrl}/blog`,
    },
  };

  return (
    <main>
      <div className="container">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <nav className="post-nav">
          <Link href="/blog" className="blog-back-link">← All Posts</Link>
          <Link href="/" className="blog-back-link">Dashboard</Link>
        </nav>

        <article className="blog-post">
          <header className="post-header">
            <time className="post-date" dateTime={post.date}>
              {formatDate(post.date)}
            </time>
            <h1 className="post-title">{post.title}</h1>
            <p className="post-desc">{post.description}</p>
            {post.tags.length > 0 && (
              <div className="blog-card-tags">
                {post.tags.map((tag) => (
                  <span key={tag} className="blog-tag">{tag}</span>
                ))}
              </div>
            )}
          </header>

          {/* Data anchors — visible reference points for the post */}
          {post.dataPoints && post.dataPoints.length > 0 && (
            <aside className="post-data-anchors">
              <div className="data-anchors-label">Data anchors referenced</div>
              <div className="data-anchors-list">
                {post.dataPoints.map((dp, i) => (
                  <span key={i} className="data-anchor">{dp}</span>
                ))}
              </div>
            </aside>
          )}

          <div
            className="post-body"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          {/* Link back to relevant dashboard sections */}
          {post.dashboardSections && post.dashboardSections.length > 0 && (
            <nav className="post-dashboard-links">
              <div className="data-anchors-label">Related dashboard charts</div>
              <div className="data-anchors-list">
                {post.dashboardSections.map((num) => (
                  <Link key={num} href={`/#section-${String(num).padStart(2, '0')}`} className="dashboard-link">
                    Chart {String(num).padStart(2, '0')}
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </article>

        <footer className="blog-footer">
          <p>
            Data sourced from{' '}
            <Link href="/">the Golf Search Trends Dashboard</Link>.
            Google Trends values are normalized 0–100 and represent relative
            search interest, not absolute volume.
          </p>
        </footer>
      </div>
    </main>
  );
}

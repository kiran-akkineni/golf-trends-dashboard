import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';
import './blog.css';

export const metadata: Metadata = {
  title: 'Weekly Insights — Golf Search Trends Blog',
  description:
    'Weekly data-driven analysis of golf search trends. What drove golf equipment, simulator, and participation search this week — tied to real Google Trends data.',
  openGraph: {
    title: 'Weekly Insights — Golf Search Trends Blog',
    description:
      'Data-anchored commentary on what moved golf search volume this week.',
    type: 'website',
  },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main>
      <div className="container">
        <header className="blog-header">
          <Link href="/" className="blog-back-link">← Dashboard</Link>
          <div className="tag-pill">Weekly Insights</div>
          <h1>
            Golf Search Trends /{' '}
            <strong>Blog</strong>
          </h1>
          <p className="blog-lede">
            Weekly data-driven analysis connecting real-world golf events to
            movements in Google Trends search data. Each post anchors its
            claims to specific data points from the dashboard.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="blog-empty">
            <p>No posts yet. Check back soon.</p>
          </div>
        ) : (
          <div className="blog-list">
            {posts.map((post) => (
              <article key={post.slug} className="blog-card">
                <Link href={`/blog/${post.slug}`} className="blog-card-link">
                  <div className="blog-card-date">{formatDate(post.date)}</div>
                  <h2 className="blog-card-title">{post.title}</h2>
                  <p className="blog-card-desc">{post.description}</p>
                  {post.tags.length > 0 && (
                    <div className="blog-card-tags">
                      {post.tags.map((tag) => (
                        <span key={tag} className="blog-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </Link>
              </article>
            ))}
          </div>
        )}

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

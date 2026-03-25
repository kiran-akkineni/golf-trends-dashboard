import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;            // YYYY-MM-DD
  tags: string[];
  dataPoints?: string[];   // key data anchors referenced, e.g. ["golf clubs Aug 2025 = 91"]
  dashboardSections?: number[]; // which chart sections are relevant, e.g. [1, 3]
  content: string;         // raw markdown body
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
}

/**
 * Get all blog post slugs (for generateStaticParams)
 */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

/**
 * Get metadata for all posts, sorted newest first
 */
export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));

  const posts: BlogPostMeta[] = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
    const { data } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? '',
      date: data.date ?? '1970-01-01',
      tags: data.tags ?? [],
    };
  });

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get a single post by slug
 */
export function getPost(slug: string): BlogPost | null {
  const filepath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filepath)) return null;

  const raw = fs.readFileSync(filepath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ?? '1970-01-01',
    tags: data.tags ?? [],
    dataPoints: data.dataPoints ?? [],
    dashboardSections: data.dashboardSections ?? [],
    content,
  };
}

/**
 * Minimal markdown → HTML converter.
 * Handles: headings, bold, italic, links, paragraphs, lists, blockquotes, inline code, hr.
 * For anything heavier, swap in remark/rehype later.
 */
export function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities in code blocks first
    .replace(/```[\s\S]*?```/g, (match) => {
      return match; // preserve code blocks as-is for now
    });

  // Process line by line
  const lines = html.split('\n');
  const output: string[] = [];
  let inList = false;
  let inBlockquote = false;
  let listType: 'ul' | 'ol' = 'ul';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.match(/^#### /)) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      output.push(`<h4>${inlineFormat(line.slice(5))}</h4>`);
      continue;
    }
    if (line.match(/^### /)) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      output.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
      continue;
    }
    if (line.match(/^## /)) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      output.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      output.push('<hr />');
      continue;
    }

    // Blockquote
    if (line.match(/^> /)) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      if (!inBlockquote) { output.push('<blockquote>'); inBlockquote = true; }
      output.push(`<p>${inlineFormat(line.slice(2))}</p>`);
      continue;
    } else if (inBlockquote) {
      output.push('</blockquote>');
      inBlockquote = false;
    }

    // Unordered list
    if (line.match(/^[-*] /)) {
      if (!inList || listType !== 'ul') {
        if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');
        output.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      output.push(`<li>${inlineFormat(line.slice(2))}</li>`);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      if (!inList || listType !== 'ol') {
        if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');
        output.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      output.push(`<li>${inlineFormat(line.replace(/^\d+\. /, ''))}</li>`);
      continue;
    }

    // Close list if we hit a non-list line
    if (inList) {
      output.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
    }

    // Empty line
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph
    output.push(`<p>${inlineFormat(line)}</p>`);
  }

  if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');
  if (inBlockquote) output.push('</blockquote>');

  return output.join('\n');
}

/**
 * Inline formatting: bold, italic, links, inline code
 */
function inlineFormat(text: string): string {
  return text
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

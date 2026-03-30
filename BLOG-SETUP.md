# Blog Scaffold — Setup Instructions

## 1. Install gray-matter

```bash
cd ~/Projects/golf-trends-dashboard
npm install gray-matter
```

## 2. Copy files into place

```bash
# Blog utility library
cp lib/blog.ts ~/Projects/golf-trends-dashboard/lib/blog.ts

# Blog routes
cp app/blog/page.tsx ~/Projects/golf-trends-dashboard/app/blog/page.tsx
cp app/blog/blog.css ~/Projects/golf-trends-dashboard/app/blog/blog.css
mkdir -p ~/Projects/golf-trends-dashboard/app/blog/\[slug\]
cp "app/blog/[slug]/page.tsx" ~/Projects/golf-trends-dashboard/app/blog/\[slug\]/page.tsx

# Content directory + sample posts
mkdir -p ~/Projects/golf-trends-dashboard/content/blog
cp content/blog/masters-week-2026-seasonal-ramp.md ~/Projects/golf-trends-dashboard/content/blog/
cp content/blog/tgl-second-season-simulator-search.md ~/Projects/golf-trends-dashboard/content/blog/
cp content/blog/_TEMPLATE.md ~/Projects/golf-trends-dashboard/content/blog/

# Updated sitemap (replaces existing)
cp app/sitemap.ts ~/Projects/golf-trends-dashboard/app/sitemap.ts
```

## 3. Push

```bash
cd ~/Projects/golf-trends-dashboard
git add lib/blog.ts app/blog/ content/blog/ app/sitemap.ts
git commit -m "Add blog: weekly insights with markdown posts, SEO metadata, structured data"
git push origin main
```

## 4. Writing new posts

1. Copy `content/blog/_TEMPLATE.md` → `content/blog/your-slug-here.md`
2. Fill in frontmatter (title, description, date, tags, dataPoints, dashboardSections)
3. Write 300–500 words of analysis anchored to dashboard data
4. Commit + push — Vercel rebuilds automatically

## File structure added

```
golf-trends-dashboard/
├── lib/
│   └── blog.ts                  # NEW — markdown reader + simple HTML converter
├── app/
│   ├── blog/
│   │   ├── page.tsx             # NEW — blog listing page
│   │   ├── blog.css             # NEW — blog styles (matches dashboard theme)
│   │   └── [slug]/
│   │       └── page.tsx         # NEW — individual post page with JSON-LD
│   └── sitemap.ts               # UPDATED — now includes blog posts
└── content/
    └── blog/
        ├── _TEMPLATE.md                           # NEW — weekly brief template
        ├── masters-week-2026-seasonal-ramp.md     # NEW — sample post
        └── tgl-second-season-simulator-search.md  # NEW — sample post
```

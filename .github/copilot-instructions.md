Project: HTML Message Search (Next.js + TypeScript)

Goal
- Accept exported HTML chat/message files (≈6MB is fine), extract message text + timestamps, and provide fast search + filtering.

Key paths
- UI: src/app/components/HtmlSearchApp.tsx
- Upload API: src/app/api/upload/route.ts
- Search API: src/app/api/search/route.ts
- Parsing: src/lib/parseHtml.ts
- Local store/cache: src/lib/storage.ts

Commands
- Dev: npm run dev
- Build: npm run build

Notes
- Parsed uploads are stored locally under data/<fileId>/ and are ignored by git.
- If deploying to serverless, replace filesystem storage with a real datastore.

This is a Next.js app that contains a **client-only Utilities Hub** (a collection of mini tools that run entirely in your browser).

One of the tools is **HTML Message Search**: upload an exported HTML chat/message file (e.g. Meta/Instagram exports), extract message blocks into plain text, and search + filter the results.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- Open the app and pick a tool from the sidebar.
- Tools run locally in your browser. For the HTML Message Search tool:
	- Upload an `.html` file.
	- The browser parses the HTML and extracts message blocks (sender, text, timestamp).
	- Parsed results are stored in the browser (IndexedDB).
	- Searches run client-side and support substring search, sender filter, and date range.

## Notes

- This is designed to work on serverless deployments (e.g. Vercel) because it does not require server storage.
- Data is per-browser (not shared across devices) unless you add a backend datastore.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

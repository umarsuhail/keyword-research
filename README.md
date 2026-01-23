This is a Next.js app that accepts exported HTML chat/message files (e.g. Meta/Instagram exports), extracts message blocks into plain text, and lets you search + filter the results.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- Upload an `.html` file on the home page.
- The server parses the HTML and extracts message blocks (sender, text, timestamp).
- Parsed results are stored locally under `data/<fileId>/` (ignored by git).
- Searches run server-side and support:
	- Substring text search
	- Sender filter
	- Date range filter (via date inputs)

## Notes

- This is designed for local usage. If you deploy to a serverless environment (e.g. Vercel), writing to the local filesystem is not persistent.

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

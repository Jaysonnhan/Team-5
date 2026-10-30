# Team-5 · Dream Journey

An English mobile student submission platform with a shared backend for ideas, proposals, daily journals, photos, research and posters.

This repository contains the application source, database schema and migrations. The running database and uploaded student files remain in cloud storage; they are not committed to GitHub.

## Included

- Four swipeable mobile stages with English voice-to-text controls.
- Cloud-backed drafts, submissions and multi-file uploads.
- Cloudflare D1 for project records and file metadata; R2 for file contents.
- Account ownership checks and optimistic version checks to prevent stale overwrites.
- Read-only case search endpoints and a JavaScript client for a separate search frontend.
- Opt-in case sharing that excludes team member names and proposal files.

## Start here

- [Search frontend integration](docs/INTEGRATION.md)
- [Database schema](db/schema.ts)
- [SQL migration](drizzle/0000_old_lenny_balinger.sql)
- [Backend API](app/api/v1/%5B...path%5D/route.ts)
- [Student interface](public/student.html)
- [Search client](public/journey-api.js)

## Local development

Use Node.js 22.13 or later (Node.js 24 recommended).

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_old_lenny_balinger.sql
npm run dev
```

Open the printed local URL. Development sign-in is available at `/signin-with-chatgpt?return_to=/student.html`. It simulates a local account; production authentication is supplied by the hosting platform.

Apply the SQL migration once per new local database. Use the same `.wrangler/state` for migrations and preview. Database records are separate between local development and production.

## Checks

```sh
npx tsc --noEmit
node tests/backend.test.cjs
npm run build
```

The backend test uses in-memory SQLite and a file-storage adapter. It checks account isolation, versions, submission validation, file access, opt-in search and private-member redaction without writing to the live database.

## Deployment

The application runs on Cloudflare Workers with D1 binding `DB` and R2 binding `BUCKET`. Hosted authentication headers must be supplied by a trusted platform; do not expose an unmanaged server that trusts arbitrary client-supplied identity headers.

The existing live deployment remains separate from this public source snapshot. Its hosting project identity, credentials, database records, uploads and local caches are excluded. Add a hosting project identity only when connecting your own deployment.

The search frontend can call the existing API using `public/journey-api.js`. Its API base is documented in the integration guide. A GitHub repository stores the code; it does not itself run the backend or replace the cloud database.

## Current scope

One active project per signed-in account. The same account can retrieve its project from another device. Different accounts save separate projects into the same database. Team invitations, staff moderation and simultaneous collaborative editing are not implemented.

# Dream Journey — Shared backend handoff

API base: `https://dream-journey-student-demo.finelemur1028.chatgpt.site/api/v1`
Student submission page: `https://dream-journey-student-demo.finelemur1028.chatgpt.site/student.html`

The student page and future search page use the same D1 database and R2 file storage. The student page is already connected. The search UI is not implemented or modified in this handoff.

## Connect the search frontend

Copy `journey-api.js` into your frontend source. This is a read-only browser client with no secret or database credentials.

```js
import { createJourneyClient } from './journey-api.js';
const api = createJourneyClient();
const { cases, hasMore } = await api.search({ q: 'village', limit: 20, offset: 0 });
const selected = await api.getCase(cases[0].id);
// selected.files contains absolute file URLs.
// Link an "Add your journey" button to api.submissionUrl.
```

`GET /cases?q=...&limit=20&offset=0` returns `{ cases, hasMore, limit, offset }`.
- `q`: case-insensitive substring search across destination, main question and team name.
- `limit`: 1–50; default 20. `offset`: zero-based pagination.
- Summary fields: `id`, `team`, `destination`, `question`, `specificQuestions`, `reflection`, `tripDays`, `updatedAt`.

`GET /cases/:id` returns `{ case: { ...summary, journals, files } }`.
- Journal fields: `day`, `observations`, `challenges`, `response`, `photoNote`. Only submitted entries within active trip duration are included.
- File fields: `id`, `kind` (`photos` or `outcomes`), `day`, `name`, `type`, `size`, `url`, `createdAt`.
- Files are downloaded via `GET /case-files/:fileId`. Relative URLs must be resolved against the backend origin.
- Case endpoints support cross-origin GET. Use `credentials: 'omit'`. Do not put secrets in the frontend.
- Team member names, owner IDs, proposal files and unfinished drafts are never returned by case endpoints.
- A case is listed only after a student opts in to sharing and submits final outcomes. An empty array is a valid result; show an empty state rather than inventing cases.
- Do not interpret participation counts or journal text as proven educational impact.

## Student write API (same origin, authenticated)

All writes use platform-owned ChatGPT sign-in. The backend derives record ownership from verified server identity, not from the submitted JSON.

| Method | Path | Purpose |
|---|---|---|
| GET | `/session` | `{ authenticated, signInUrl }` |
| GET | `/project` | Current user's project, or null |
| PUT | `/project` | Save `{ version, document }`; returns updated project/version |
| GET | `/files` | Current user's file metadata |
| POST | `/files` | Multipart `file`, `kind`, `day` for photos |
| GET | `/files/:id` | Authorized private download |
| DELETE | `/files/:id` | Remove owned file and invalidate affected submission |
| GET | `/health` | API version and configured storage type |

`document` includes `fields`, `days` (1–30), `selectedDay`, `journals`, `submitted` (4 booleans) and `shareWithLibrary`.

`fields`: `destination`, `question`, `specifics`, `team`, `members`, `proposalNote`, `reflection`.
`journals`: dictionary keyed by day; each entry has `observations`, `challenges`, `response`, `photoNote`, `submitted`.

First save uses version 0. Each accepted document write increments version. HTTP 409 means a newer copy exists: preserve local text, reload, and review before saving. Do not blindly retry with a new version.

Files: 15 MB per file; image/PDF/Word for proposal and outcomes, images for journal photos. Final submission requires at least two outcome files. Photos and documents live in R2, not as base64 in SQL. File metadata is stored in D1.

## Current boundaries

- One active journey per signed-in account. Same account on another device sees the same cloud record after reload. Different accounts have separate records in the same central database.
- This is not a shared-password or team-invitation system. Team membership and staff moderation roles can be added later if required.
- Cross-device synchronization is save/load, not live collaborative editing; optimistic version checks prevent stale overwrites.
- Records remain private unless sharing is explicitly selected. Proposal files and member names remain private even for shared cases.
- Database and file test fixtures are local only. Production is not seeded with fictional student projects.

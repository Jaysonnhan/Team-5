# Administrator console

Open `/admin` on the deployed site. The page is English and reads the same D1 database and R2 bucket as the student submission page.

## Available views

- All projects, including private drafts and final submissions.
- Overview counts for projects, final submissions, submitted journal entries and uploaded files.
- Search by team, destination or research question.
- Filters for final submissions, in-progress projects and projects without files.
- Full idea/team fields, proposal notes, each day's journal, photo notes and final reflection.
- Authenticated image/PDF previews and downloads of all project attachments. Other document formats are downloadable.
- Pagination and manual refresh for newly saved student work.

The console is read-only. It does not edit, publish, delete or approve student records.

## Authorization

The server checks both the hosting platform's verified user identity and its verified email header. The email must match the runtime `ADMIN_EMAILS` allowlist (comma-separated, case-insensitive). Ordinary sign-in alone does not grant access. An unknown account receives HTTP 403; an anonymous request receives HTTP 401.

Configure `ADMIN_EMAILS` as a server runtime secret through the hosting platform, then deploy the new environment revision. Do not hardcode real administrator emails, keys, account cookies or tokens in public source or browser JavaScript. Production authorization is not based on a user-editable checkbox or a localStorage flag.

For portable local preview only, an ignored `.dev.vars` file can contain:

```text
ADMIN_EMAILS="seedy@sites.test"
```

This matches the starter's local development identity. The local mock sign-in is excluded from production. Do not expose the development server publicly.

A signed-in administrator sees an Admin Console link in the student page header. Other visitors do not see that link; the API still enforces authorization if they visit the URL directly.

## Read-only endpoints

| Method | Path | Result |
|---|---|---|
| GET | `/api/v1/admin/overview` | Aggregate metrics |
| GET | `/api/v1/admin/projects?q=&status=all&limit=25&offset=0` | Project summaries and pagination |
| GET | `/api/v1/admin/projects/:id` | Complete project and file metadata |
| GET | `/api/v1/admin/files/:id` | Authorized file download |
| GET | `/api/v1/admin/files/:id?preview=1` | Inline image/PDF when safe; otherwise download |

No admin endpoint enables cross-origin access. File URLs are checked on every request and return private, non-cacheable responses. Admin role configuration is kept outside the database and outside GitHub.

## Verification

Backend tests cover administrator allowlisting, anonymous/student denial, metrics, filtering, project details, private file access and read-only enforcement. Browser checks cover dashboard loading, details, journal expansion, no-result search, and a local test report download. Local fixtures are separate from production submissions.

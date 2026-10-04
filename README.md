# Personal portfolio

The existing JavaScript Create React App website, retaining its original black background, moving pixels, logo, sidebar, and public page layouts. Includes résumé, projects, a local drawing canvas, a focus timer, a public Blog, and a per-account Private Journal. Public pages require no sign-in. Microsoft Entra sign-in and sign-out are available in the expandable sidebar when configured.

The original wedding website is preserved as a public keepsake at `/weddingsite`, with its photos and layout. Any username can sign in and select a guest, wedding party, rehearsal, or brunch layout. Guest choices and RSVP responses stay in the current browser tab; no guest database is connected. Its source lives in `wedding-site`; the build combines both applications into one deployable artifact.

## Blog and journal storage at a glance

The restored writing features use Supabase Free: Postgres stores titles and rich-text documents, and a private Storage bucket stores images. The existing Azure Static Web Apps Free backend connects them to the site. Microsoft remains the sign-in provider; users do not need a Supabase account. Anyone can read published blog posts, only the Owner can manage them, and every signed-in user has a separate private journal. The editor supports formatting, links, images, alt text and preview.

The Supabase Free project is provisioned, the database migration is applied, and the backend connection and private image bucket were verified. Server credentials are configured in Azure backend settings. The detailed setup below covers the migration, server settings, free-plan quotas, inactivity pausing and backups. Creating this integration does not enable a paid storage plan. Production deployment and signed-in account checks are verified separately from database provisioning.

This README documents setting names and placeholders only. Database passwords, Supabase secret keys, access tokens and private journal content must never appear in source, commits, pull requests, screenshots or logs. Supabase credentials belong only in the Azure backend application settings; the browser receives no database credential. The existing workflow deploys the application, and the documented migration prepares the database separately.

## Local development

Use Node.js 22:

```sh
npm ci
npm ci --prefix api
npm test --prefix api
npm run build --prefix api
npm start
npm test -- --watchAll=false --runInBand
npm run test:wedding
npm run build
```

The static pages and local tests need no runtime secrets. The content API needs server app settings configured separately by the root operator. Do not create or upload `.env` files for this site. Never put secrets in `REACT_APP_*` variables, which are embedded in browser code.

## Microsoft Entra sign-in

The SPA uses `@azure/msal-browser` 4.30.0 and `@azure/msal-react` 3.0.29 with React 18. Set the public build variables `REACT_APP_AZURE_AD_CLIENT_ID` and `REACT_APP_AZURE_AD_TENANT_ID` to the existing production application and tenant GUIDs through the shell environment. No IDs are hardcoded and no client secret is needed. Missing or malformed values disable sign-in with an explanation; public pages still render. Configuration changes require rebuilding.

GitHub's build step reads repository **Variables** `AZURE_AD_CLIENT_ID` and `AZURE_AD_TENANT_ID` (not Secrets). The operator configures these separately. These identify the application and tenant publicly; they are not credentials. Do not place real account identifiers in tracked source or example files.

The operator maintains the Entra app registration as a single-tenant SPA with root redirect URIs `https://mcnairscode.com/` and `https://www.mcnairscode.com/`. The app always uses the current origin plus `/` for login and post-logout redirects. For local sign-in testing, the operator must register the corresponding local root URI separately. Sidebar login uses redirect rather than popup and requests `openid`, `profile`, and `email`, and stores MSAL's cache in `sessionStorage`. It does not request Graph `User.Read`. MSAL initializes and handles the redirect response before account controls become usable; startup/redirect errors leave public pages accessible and offer retry.

Account names and recognized roles come only from MSAL AccountInfo ID token claims: `OwnerRole` → Owner, `WifeRole` → Wife, `FriendRole` → Friend. Unknown roles confer nothing, and accounts without recognized claims display “No assigned role.” There is no email matching or role selector. The operator assigns WifeRole to the intended Charlotte account in Azure; no friends are currently assigned. Assignments belong solely in Entra, never in this repository. The wedding keepsake's browser-local guest layout choices are independent of Entra roles.

The sidebar silently renews the account's ID token on startup and near expiry (on tab focus or a minute timer). Claims returned by MSAL replace the displayed roles. Renewal errors suppress stale role display and offer retry or sign-in again; interaction-required errors explicitly require reauthentication. Sign-in/out controls are disabled during SDK interactions and local requests. Tokens and raw SDK errors are never displayed or logged by this integration.

Portfolio CSP allows connections and frames only to the tenant login origin `https://login.microsoftonline.com` in addition to self. Redirect navigation uses normal top-level navigation; no script/style relaxation or wildcard is needed. Wedding CSP and other security headers stay unchanged. Existing anti-embedding headers may prevent an iframe-based silent fallback from loading the root callback; use the offered top-level sign-in again if silent renewal cannot complete. Browser privacy policies and Entra session policy can also require reauthentication.

**Frontend role display is not backend authorization.** The content API verifies scoped Entra access tokens. Blog editor capability comes from the API response, never the sidebar’s ID-token role display. ID tokens are rejected by the API.

## Delivery

Commits to `main` automatically install dependencies, test, build, deploy, and verify the resulting website. Pull requests validate without deploying. Deployment credentials and the verification target are configured in GitHub Actions Secrets, outside the repository. GitHub masks their values in workflow logs.

Required repository secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN`, `PRODUCTION_URL`, and `AZURE_SITE_HOSTNAME`. The hostname secret also masks Azure's generated deployment output. Infrastructure configuration, if needed, uses `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, and `AZURE_STATIC_WEB_APP_NAME`. The provisioning script reads those values from your local environment; authenticated Azure CLI access is also required. DNS records and account-specific setup are managed in the hosting and registrar accounts and are intentionally omitted here.

Do not commit account identifiers, DNS validation values, tokens, connection strings, or private configuration files. Content secrets belong only in Static Web Apps backend application settings, never in frontend build variables. Managed Functions on SWA Free do not use managed identity or Key Vault references.

## Maintenance

Public pages are in `src/components`; their original styles are retained. Sidebar and pixel animation are separate components; Entra initialization and sidebar controls are in `src/auth`. The drawing and timer tools keep state only for the current page visit. Downloads preserve drawings. Calendar, recovery, standalone login, and direct storage/database pages remain removed. Interests and its exclusive stylesheet were removed; `/interests` and `/interests/` return hosting 404 and client navigation shows the existing not-found page.

Hosting routes and security headers are in `public/staticwebapp.config.json`. Add new public paths there as well as in React. Missing pages and assets return 404. Infrastructure is defined in `infra/main.bicep`; provisioning is optional after the site already exists.

Tests mock MSAL without credentials or live Entra requests, covering configuration, initialization/redirect failures, role display, sign-in/out, busy state, cancellation, and renewal recovery. Deployment verification checks known public routes, removed Interests returning HTTP 404, Entra CSP allowances, and the wedding policy. Live sign-in, Azure role assignments, and registered redirect URIs must be verified by the operator after supplying public build variables; local tests cannot prove the production tenant configuration.

Create React App is retained as requested. Its older build dependency tree still has audit findings; review build tooling maintenance separately. The browser contains no runtime cloud credentials; only the managed API has server settings.


## Blog and private Journal

`/blog` is public, including `/blog/:id` links. `/journal` offers a Microsoft sign-in gate and performs no private request when signed out. OwnerRole in a **verified access token** alone permits creating, editing, deleting, publishing and unpublishing blog posts. Drafts and orphan/draft images are never public. WifeRole, FriendRole, and accounts without roles can use their own journals. Even OwnerRole cannot read another account’s journal; there is no administrative override.

The existing SPA remains JavaScript, CRA 5 and React 18. `api/` is an independent Node 22 Azure Functions v4 application deployed as integrated managed HTTP Functions on the existing Azure Static Web Apps **Free** plan. All browser requests use same-origin `/api`; there is no browser Supabase SDK, direct database access, SAS, storage key, CORS widening, or backend in the wedding app. No new Azure resources are needed and no Cosmos/Blob dependencies are used.

Post metadata and document JSON live in **Supabase Free Postgres**; raster image bytes live in the private Supabase `portfolio-images` bucket. The server service role deliberately bypasses RLS. Every journal list/get/write/delete/upload/download uses the server-derived `journal:<tid>:<oid>` namespace and owner metadata from the verified account. No email, client-supplied identity/namespace, role hint or `X-MS-CLIENT-PRINCIPAL` is trusted. SQL constraints reinforce ownership; all journal queries/deletes filter namespace, kind, owner_tid and owner_oid. Blog cannot reference journal assets, including the owner’s own journal images.

Tiptap supplies bold, italic, underline, three heading levels, bullet/number lists, links, undo/redo, image picker/drop, editable image alt text, and a safe preview. Documents persist editor JSON with only `assetId` + `alt` for images. Browser and server share the strict validator in `src/content/schema.js`; API builds package the identical file. Only supported nodes/marks, http/https/mailto links, maximum 200-character title, 200 KB request body, 3,000 nodes and depth 20 are accepted. React renders escaped text and supported nodes; raw HTML is not rendered. External/pasted HTML images are not imported. Uploads are JPEG/PNG/WebP only, up to 5 MB, with server magic-byte and MIME agreement checks; SVG/GIF and arbitrary paths are rejected. Magic-byte checks and a bounded Sharp pixel decode reject corrupt/spoofed rasters and animated images; input is limited to 40 million pixels. Images retain their original bytes and EXIF metadata. Consider removing location metadata from photos before upload.

Saving a new blog post as a draft keeps it private; publishing exposes its content and referenced images. Unpublishing saves a draft and revokes new anonymous image requests immediately. Journals always have private status and no publish switch. Edit loads the latest entry; delete and conflict reload require confirmation. Writes/deletes require `If-Match: "<integer version>"`; mismatches return 412 rather than overwrite. Save conflicts preserve the current editor until the user reloads/discards; transient failures allow retry. No success is shown before a database response and no content is saved to localStorage. Cancel discards editor changes but may leave uploaded orphan assets.

Account identity keys the entire content view. Switching account/unmounting clears private entries/editor, aborts pending requests, and revokes image object URLs during layout cleanup. Access-token acquisition is silent for the current MSAL account and validates the returned account. Interaction-required failures offer explicit **Sign in again**; they do not auto-open popups or redirect loops. All content/media responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Private media is bearer-authorized and fetched to temporary object URLs; no public bucket URL is generated. Public image visibility is determined from current published blog references on every API GET. Revocation cannot retract bytes already downloaded or a response authorized before unpublishing.

### Operator setup (no credentials in source or uploads)

1. Create/select a **Supabase Free** project in the operator account; keep the organization on Free with no paid upgrade. No Azure database/storage provisioning is required.
2. Apply [001_portfolio_content.sql](supabase/migrations/001_portfolio_content.sql) using Supabase’s SQL editor. It can be reapplied. It creates UUID posts/assets, namespace/owner/status constraints, feed and asset-reference indexes, RLS-enabled tables, a transaction RPC for asset validation and optimistic writes, and a private 5 MB JPEG/PNG/WebP bucket. PUBLIC/anon/authenticated have no content-table grants or write/read policies. Only service_role receives table access and RPC execution. A restrictive Storage policy denies this bucket to anon/authenticated even if permissive policies exist for other buckets. Audit any custom database/storage grants before deployment; do not add public object policies.
3. In the same existing single-tenant Entra application, expose delegated scope `api://<clientId>/access_as_user`, set `api.requestedAccessTokenVersion=2`, and configure consent/preauthorization for this SPA. Assign OwnerRole for blog management. Register the production/local root SPA redirect URIs separately. Journal access does not require an app role; tenant app assignment/access settings must allow the intended accounts.
4. Set the following **backend-only SWA application settings** in the operator account:

| Setting | Exact contract |
| --- | --- |
| `ENTRA_TENANT_ID` | Existing single tenant GUID, canonical lowercase |
| `ENTRA_CLIENT_ID` | Existing SPA/API application GUID, canonical lowercase; exact access-token audience |
| `ENTRA_SCOPE` | `access_as_user` |
| `SUPABASE_URL` | Operator project HTTPS URL `https://<project-ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | New Supabase secret key or legacy `service_role` key; server only |
| `SUPABASE_BUCKET` | `portfolio-images` |

The only frontend build configuration remains the existing public `REACT_APP_AZURE_AD_CLIENT_ID` and `REACT_APP_AZURE_AD_TENANT_ID`. The frontend computes `api://<REACT_APP_AZURE_AD_CLIENT_ID>/access_as_user`; no Supabase URL/key/anon key or extra public settings are needed. The API pins the tenant’s HTTPS JWKS, verifies RS256 signature, issuer `https://login.microsoftonline.com/<tenant>/v2.0`, exact GUID audience, lifetime, tid, oid, ver=2.0 and delegated scp. Graph tokens, ID tokens, wrong tenants/audiences, expired tokens and forged roles fail with 401. Supplying invalid authorization never downgrades a public request to anonymous. Generic errors do not expose raw SDK responses or credentials.

### API contract

Authenticated content requests send the verified Entra bearer token in `X-Portfolio-Authorization`. Azure's managed Functions proxy controls the standard `Authorization` header, so the application does not use it for user identity. Requests without the application header are anonymous; malformed or invalid application tokens still return 401. The API continues to verify signatures, issuer, audience, account and scope, and never trusts hosting principal headers or browser role hints.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/blog?limit=10&cursor=...` | Anonymous published feed; valid Owner token also sees drafts; returns items, cursor, canWrite |
| `GET /api/blog/<uuid>` | Published post, or draft for verified Owner |
| `POST /api/blog` | Owner create `{title, document, status: draft/published}` |
| `PUT /api/blog/<uuid>` / `DELETE /api/blog/<uuid>` | Owner edit/delete; `If-Match` required |
| `GET /api/journal?limit=10&cursor=...` / `GET /api/journal/<uuid>` | Scoped token required; own account only |
| `POST /api/journal` | Own create `{title, document, status: private}` |
| `PUT /api/journal/<uuid>` / `DELETE /api/journal/<uuid>` | Own edit/delete; `If-Match` required |
| `POST /api/media/blog` / `POST /api/media/journal` | Owner/own authenticated raw raster bytes + exact image Content-Type; returns `{assetId}` |
| `GET /api/media/blog/<assetId>` | Public only while referenced by a current published blog post; otherwise Owner token required |
| `GET /api/media/journal/<assetId>` | Scoped token and matching account only; streamed proxy, never SAS or direct URL |

Lists default to 10 and allow 1–20 entries, using date/UUID ordering and a bounded opaque cursor scoped to the caller namespace and visibility. Owner metadata and storage paths never appear in public DTOs. The SQL save RPC validates assets and increments the version atomically; deletes are conditional on version and namespace/ownership. Assets have immutable random UUID paths derived by the server. There is no asset deletion endpoint that can invalidate another entry’s references. Missing/foreign posts/images return 404; unsigned journal calls return 401; nonOwner blog writes return 403; malformed input returns 400/413; missing versions return 428; conflicts return 412. Storage/network/quota failures return a safe retryable 503, never fake persistence.

### Free plan limits and retention

The [Supabase pricing page](https://supabase.com/pricing) lists Free limits of 500 MB database, 1 GB file storage, 5 GB egress plus 5 GB cached egress, and two active projects. The API’s no-store proxy does not promise use of cached egress. Keep the project on Free; this implementation does not enable paid upgrades or add monthly dedicated resources. Free is subject to quotas and provider terms, not a promise of lifetime availability. The [Free project pausing guide](https://supabase.com/docs/guides/platform/free-project-pausing) says projects with low activity over seven days may pause. The operator restores a paused project in the dashboard; there is no artificial keepalive. No managed-backup guarantee is claimed for Free. Arrange operator exports/backups for content that matters.

There is no automatic historical migration because historical source content is not available. Uploaded assets that are canceled, removed from documents or left after post deletion remain private orphans until operator cleanup. Cleanup must check current post references first and must not delete unrelated posts/assets. There is no background retention job or artificial entry quota discarding journal data. Monitor provider storage limits and clean up unused assets manually.

### Validation and deployment

Root and API have independent lockfiles. `npm ci` installs the portfolio and wedding workspace; `npm ci --prefix api` installs server dependencies. `npm test --prefix api` uses native node tests with locally signed JWTs and an injected local JWKS, a Supabase query/storage mock that can see all accounts, and embedded PostgreSQL (PGlite) to apply the actual migration twice and test RLS, constraints and RPC conflicts. No live keys, model calls or cloud requests are used. Frontend tests exercise real Tiptap operations, picker/drop, gates, token/account checks, private view clearing, object URL cleanup, drafts and conflict recovery. Existing portfolio/wedding tests remain in CI.

CI builds both static apps and packages the standalone API runtime source and lockfile in the same verified artifact. Deployment uses the prebuilt `build/` frontend with `skip_app_build: true`, `api_location: api`, and API build enabled so SWA installs the independent Node dependencies. `platform.apiRuntime` is `node:22`; the API `build` script uses its packaged validator if frontend source is absent. No `api/` route is rewritten to SPA HTML; Interests stays 404 and wedding CSP is unchanged. Deployment verification now includes a public blog API response and anonymous journal 401, without reading secret content. Configure the migration/appsettings before deploying; verification will fail if the public API is unavailable.

The operator must still validate real Entra consent/role issuance, Supabase configuration/quotas, managed Functions packaging and end-to-end two-account isolation after applying and deploying. The local suite cannot prove those production settings. See [SWA build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration), [SWA Node22 configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration), [Supabase RLS/service roles](https://supabase.com/docs/guides/database/postgres/row-level-security), [private Storage downloads](https://supabase.com/docs/reference/javascript/storage-from-download), and [Tiptap React installation](https://tiptap.dev/docs/editor/getting-started/install/react).

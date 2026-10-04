# Personal portfolio

The existing JavaScript Create React App website, retaining its original black background, moving pixels, logo, sidebar, and public page layouts. Includes résumé, projects, a local drawing canvas, and a focus timer. Public pages require no sign-in. Microsoft Entra sign-in and sign-out are available in the expandable sidebar when configured.

The original wedding website is preserved as a public keepsake at `/weddingsite`, with its photos and layout. Any username can sign in and select a guest, wedding party, rehearsal, or brunch layout. Guest choices and RSVP responses stay in the current browser tab; no guest database is connected. Its source lives in `wedding-site`; the build combines both applications into one deployable artifact.

## Local development

Use Node.js 22:

```sh
npm ci
npm start
npm test -- --watchAll=false --runInBand
npm run test:wedding
npm run build
```

No website runtime secrets are required. Do not create or upload `.env` files for this site. Never put secrets in `REACT_APP_*` variables, which are embedded in browser code.

## Microsoft Entra sign-in

The SPA uses `@azure/msal-browser` 4.30.0 and `@azure/msal-react` 3.0.29 with React 18. Set the public build variables `REACT_APP_AZURE_AD_CLIENT_ID` and `REACT_APP_AZURE_AD_TENANT_ID` to the existing production application and tenant GUIDs through the shell environment. No IDs are hardcoded and no client secret is needed. Missing or malformed values disable sign-in with an explanation; public pages still render. Configuration changes require rebuilding.

GitHub's build step reads repository **Variables** `AZURE_AD_CLIENT_ID` and `AZURE_AD_TENANT_ID` (not Secrets). The operator configures these separately. These identify the application and tenant publicly; they are not credentials. Do not place real account identifiers in tracked source or example files.

The operator maintains the Entra app registration as a single-tenant SPA with root redirect URIs `https://mcnairscode.com/` and `https://www.mcnairscode.com/`. The app always uses the current origin plus `/` for login and post-logout redirects. For local sign-in testing, the operator must register the corresponding local root URI separately. Login uses redirect rather than popup, explicitly requests only `openid`, `profile`, and `email`, and stores MSAL's cache in `sessionStorage`. It does not request Graph `User.Read`. MSAL initializes and handles the redirect response before account controls become usable; startup/redirect errors leave public pages accessible and offer retry.

Account names and recognized roles come only from MSAL AccountInfo ID token claims: `OwnerRole` → Owner, `WifeRole` → Wife, `FriendRole` → Friend. Unknown roles confer nothing, and accounts without recognized claims display “No assigned role.” There is no email matching or role selector. The operator assigns WifeRole to the intended Charlotte account in Azure; no friends are currently assigned. Assignments belong solely in Entra, never in this repository. The wedding keepsake's browser-local guest layout choices are independent of Entra roles.

The sidebar silently renews the account's ID token on startup and near expiry (on tab focus or a minute timer). Claims returned by MSAL replace the displayed roles. Renewal errors suppress stale role display and offer retry or sign-in again; interaction-required errors explicitly require reauthentication. Sign-in/out controls are disabled during SDK interactions and local requests. Tokens and raw SDK errors are never displayed or logged by this integration.

Portfolio CSP allows connections and frames only to the tenant login origin `https://login.microsoftonline.com` in addition to self. Redirect navigation uses normal top-level navigation; no script/style relaxation or wildcard is needed. Wedding CSP and other security headers stay unchanged. Existing anti-embedding headers may prevent an iframe-based silent fallback from loading the root callback; use the offered top-level sign-in again if silent renewal cannot complete. Browser privacy policies and Entra session policy can also require reauthentication.

**Frontend role display is not backend authorization.** There are no private journal/calendar pages or backend services. Any future API must validate access tokens (signature, issuer, audience, expiry) and enforce roles server-side. ID token UI claims must not be used as API authorization.

For the optional development agent, see [agent setup and task profiles](agent-config/README.md). It reuses local credentials, supports separate maintenance/review/resume/photo-edit tasks, and does not run model inference during setup.

## Delivery

Commits to `main` automatically install dependencies, test, build, deploy, and verify the resulting website. Pull requests validate without deploying. Deployment credentials and the verification target are configured in GitHub Actions Secrets, outside the repository. GitHub masks their values in workflow logs.

Required repository secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN`, `PRODUCTION_URL`, and `AZURE_SITE_HOSTNAME`. The hostname secret also masks Azure's generated deployment output. Infrastructure configuration, if needed, uses `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, and `AZURE_STATIC_WEB_APP_NAME`. The provisioning script reads those values from your local environment; authenticated Azure CLI access is also required. DNS records and account-specific setup are managed in the hosting and registrar accounts and are intentionally omitted here.

Do not commit account identifiers, DNS validation values, tokens, connection strings, or private configuration files. Application secrets for future server features belong in Azure Key Vault or protected runtime settings, never in frontend code.

## Maintenance

Public pages are in `src/components`; their original styles are retained. Sidebar and pixel animation are separate components; Entra initialization and sidebar controls are in `src/auth`. The drawing and timer tools keep state only for the current page visit. Downloads preserve drawings. Unavailable private journal, calendar, recovery, standalone login, storage, and database pages remain removed. Interests and its exclusive stylesheet were removed; `/interests` and `/interests/` return hosting 404 and client navigation shows the existing not-found page.

Hosting routes and security headers are in `public/staticwebapp.config.json`. Add new public paths there as well as in React. Missing pages and assets return 404. Infrastructure is defined in `infra/main.bicep`; provisioning is optional after the site already exists.

Tests mock MSAL without credentials or live Entra requests, covering configuration, initialization/redirect failures, role display, sign-in/out, busy state, cancellation, and renewal recovery. Deployment verification checks known public routes, removed Interests returning HTTP 404, Entra CSP allowances, and the wedding policy. Live sign-in, Azure role assignments, and registered redirect URIs must be verified by the operator after supplying public build variables; local tests cannot prove the production tenant configuration.

Create React App is retained as requested. Its older build dependency tree still has audit findings; review build tooling maintenance separately. The deployed site contains static files and no runtime cloud credentials.

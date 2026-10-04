# Personal portfolio

The existing JavaScript Create React App website, repaired while retaining its original black background, moving pixels, logo, sidebar, and public page layouts. Includes résumé, projects, interests, a local drawing canvas, and a focus timer.

The original wedding website is preserved as a public keepsake at `/weddingsite`, with its photos and layout. Any username can sign in and select a guest, wedding party, rehearsal, or brunch layout. Guest choices and RSVP responses stay in the current browser tab; no guest database is connected. Its source lives in `wedding-site`; the build combines both applications into one deployable artifact.

## Local development

Use Node.js 22:

```sh
npm ci
npm start
npm test -- --watchAll=false --runInBand
npm run build
```

No website runtime credentials are required. Keep local agent credentials in ignored `.env.local`; never put secrets in `REACT_APP_*` variables, which are embedded in browser code.

## Delivery

Commits to `main` automatically install dependencies, test, build, deploy, and verify the resulting website. Pull requests validate without deploying. Deployment credentials and the verification target are configured in GitHub Actions Secrets, outside the repository. GitHub masks their values in workflow logs.

Required repository secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN`, `PRODUCTION_URL`, and `AZURE_SITE_HOSTNAME`. The hostname secret also masks Azure's generated deployment output. Infrastructure configuration, if needed, uses `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, and `AZURE_STATIC_WEB_APP_NAME`. The provisioning script reads those values from your local environment; authenticated Azure CLI access is also required. DNS records and account-specific setup are managed in the hosting and registrar accounts and are intentionally omitted here.

Do not commit account identifiers, DNS validation values, tokens, connection strings, or private configuration files. Application secrets for future server features belong in Azure Key Vault or protected runtime settings, never in frontend code.

## Maintenance

Public pages are in `src/components`; their original styles are retained. Sidebar and pixel animation are separate components. The drawing and timer tools keep state only for the current page visit. Downloads preserve drawings. Unavailable private journal, calendar, recovery, login, storage, and database integrations were removed.

Hosting routes and security headers are in `public/staticwebapp.config.json`. Add new public paths there as well as in React. Missing pages and assets return 404. Infrastructure is defined in `infra/main.bicep`; provisioning is optional after the site already exists.

Create React App is retained as requested. Its older build dependency tree still has audit findings; review build tooling maintenance separately. The deployed site contains static files and no runtime cloud credentials.

# Girasole Netlify test migration

This branch is isolated from the Vercel production branch. Do not change the production domain or the Vercel project during this test.

## Netlify site setup

1. Create a new site in Netlify and import `adimolnar85am-bot/girasole`.
2. Select the branch `test/netlify-migration` as the site's production branch for this isolated test site.
3. Keep the build command and publish directory from `netlify.toml`: `npm run build` and `dist`.
4. In Site configuration → Environment variables, add:
   - `GITHUB_TOKEN`: a GitHub token with Contents: Read and write access limited to the `girasole` repository.
   - `GITHUB_BRANCH`: `test/netlify-migration`
   - `GITHUB_REPO`: `adimolnar85am-bot/girasole`
5. Trigger a fresh deploy after setting the variables.

Do not add these variables to the Vercel project. Do not connect the Girasole production domain to this test site.

## What the migration changes

- Static site files are copied to `dist/`. The private `data/admin-config.json` and server-side source folders are not published as static files.
- `/api/content` and `/api/assets` are rewritten to Netlify Functions.
- The functions adapt Netlify's Lambda event format to the existing Girasole API handlers.
- Admin writes use the explicit test branch above. The production `master` branch is not a target.

## Validation checklist

- Home page and images load.
- `/api/content` returns the site content.
- `/admin` loads and admin login works.
- `/api/assets` lists the image library.
- Admin can save an edited test value and it appears in `data/site-content.json` on `test/netlify-migration`.
- An uploaded test image is committed to `assets/` on `test/netlify-migration`.
- No production domain or Vercel production deployment is changed.

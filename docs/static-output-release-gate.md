# Wayfarer static-asset isolation release gate

## Confirmed before-change behavior

On the protected Vercel Preview at commit `e0f20cb`, actual authorized GET requests to `/tests/security-explore-cache-policy.test.mjs`, `/scripts/preview-http-smoke.mjs`, `/docs/release-security-preflight.md`, `/.github/workflows/checks.yml` and `/server.mjs` returned HTTP 200. The project-root files `/package.json`, `/vercel.json`, `/.env` and `/.git/config` returned 404.

These are unnecessary public static source exposures. No leaked keys or credentials were observed in these checks, but exposing implementation and release metadata should be avoided.

## Fix and safety boundaries

- Vercel `Other` framework uses explicit `outputDirectory: public` and `buildCommand: npm run build`.
- `npm run build` runs `scripts/stage-public-assets.mjs`: it copies only the 17 fixed filenames in `static-asset-manifest.mjs`, rejecting paths, symlinks, empty or oversized inputs, and deleting old generated outputs.
- No external network access, paid-provider calls, token reads or package installation is needed.
- Root `api/` serverless function sources remain separate from static output. **A real Vercel Preview must demonstrate API routing works** before merging.
- `public/` is ignored by Git; the generator and tests remain in the repository but must not be published as static assets.
- The existing read-only protected-preview smoke check requires 404 for five known internal paths.

## Verification

Run `npm run check && npm run build && npm test`. The protected Vercel Preview for the *exact feature-branch commit* must return:
1. HTTP 200 for `/`, the optimized WebP, all six active CSS and five JS files, public JSON, and `robots.txt` / `sitemap.xml`.
2. HTTP 404 for `/server.mjs`, `/scripts/*`, `/tests/*`, `/docs/*`, `/.github/workflows/*`, `/package.json` and `/vercel.json`.
3. Working serverless `/api/explore` rejection of malformed coordinates (400, `no-store`) and normal source-backed search (200); paid POST-only routes reject GET (405, no-store).
4. Matching security headers, four-device local Chrome journey tests and the existing API benchmark.

**Do not merge** if Vercel loses or misroutes any serverless API or customer-visible static file. Do not modify the public Production alias, change provider keys or lift Preview protection to run these checks.

This is one stage of release hardening, not an authorization to deploy Production or a guarantee against all source exposure or application vulnerabilities.

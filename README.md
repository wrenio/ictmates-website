# ICTmates website

A static Astro marketing website for ICTmates and Wrenio Commerce, designed for SiteGround hosting.

## Repository and live site

Source repository: https://github.com/wrenio/ictmates-website

The approved website was deployed to https://ictmates.com/ and https://www.ictmates.com/ on 19 October 2026. Both homepages and the deployed assets were verified against the local release. SiteGround's stale dynamic cache was flushed during deployment. The `WP old website` backup and `.well-known` directories were preserved.

## Develop

The working copy uses Astro 7.4.0. Use Node.js 22.22 or newer (validated with Node.js 24.15.0).

Windows PowerShell:

```powershell
$env:ASTRO_TELEMETRY_DISABLED = '1'
npm ci
npm run dev
```

macOS/Linux:

```sh
npm ci
export ASTRO_TELEMETRY_DISABLED=1
npm run dev
```

## Build and verify

```sh
export ASTRO_TELEMETRY_DISABLED=1
npm run build
npm run preview
```

The static website is generated in `dist/`. There is no application server or database required for deployment. Google Fonts is used for typography, with local system fallbacks.

## SiteGround deployment

The saved Windows SSH connection is `sg_ictmates`. The intended document root is `/home/customer/www/ictmates.com/public_html/`. The old WordPress installation has already been moved into `WP old website` as a backup and is outside this project's scope. Leave that backup untouched.

No production files were changed during recovery. Automatic deployment from `main` is now configured as described below. The deployable output is the **contents** of `dist/`, also packaged locally as `artifacts/ictmates-siteground.zip`.

### Automatic deployment

Every push to `main` runs [Deploy website to SiteGround](https://github.com/wrenio/ictmates-website/actions/workflows/deploy-siteground.yml). It can also be rerun manually with **Run workflow** on `main`. No manual approval is required. Other branches do not deploy.

The workflow runs deployment protection tests, installs the locked dependencies with `npm ci`, builds with Node.js 24, and packages only generated static files. Deployments are serialized so one release cannot interrupt another. Both public HTTPS homepages are checked against the release after SiteGround's dynamic cache is flushed.

A dedicated key is stored in the GitHub `production` environment as `SITEGROUND_DEPLOY_KEY`, restricted to the `main` branch. The runner creates its own `sg_ictmates` SSH alias and verifies the pinned ED25519 host key in `ops/siteground_known_hosts`. Your Windows personal key is not stored in GitHub.

On SiteGround, the key is restricted to `/home/customer/.ictmates-deploy/deploy_receiver.py`; it cannot run arbitrary shell commands or forward connections. The receiver rejects protected paths, hidden paths, traversal, symlinks, and executable server-side files. It publishes assets before `index.html`, retains older hashed assets, and never recursively synchronizes or deletes website directories. `WP old website`, `.well-known`, and unrelated files are preserved. Before/after metadata checks cover the protected directories.

The installed receiver must match `ops/deploy_receiver.py` in the checkout; the workflow fails safely if these differ. A receiver update requires installing the reviewed script using the owner's existing SSH connection. Previous overwritten static files and deployment receipts are retained outside the web root under `/home/customer/.ictmates-deploy/releases/`.

To revoke automatic SSH access, remove only the `ictmates-github-actions` key line from SiteGround's `/home/customer/.ssh/authorized_keys2` and remove the GitHub environment secret. Preserve the other registered keys. To pause automatic deployment without changing keys, disable this workflow in GitHub Actions.

Before launch, inventory the existing WordPress URLs and configure redirects for any pages being replaced. The current implementation is a single marketing page, not a migration of the existing blog or portfolio. Confirm the displayed phone number, commercial terms, domain-registration offer and demo destination. The WC demo is a temporary test site and should be updated when its production destination is available.

## Content and interactions

- Edit copy and pricing in `src/pages/index.astro`.
- Edit the visual design in `src/styles/global.css`.
- Pricing buttons lead to the contact section and identify the selected plan.
- The contact button opens WhatsApp for +92 300 555 1575 in a new tab. Pricing buttons prefill the selected plan in the WhatsApp message. No message is sent automatically, and no form submission or checkout is implemented.
- The storefront in the hero is an original CSS illustration, not a screenshot or promise of a specific theme.
- No subscription is purchased and no seller account is created on this marketing site.

## Current commercial offer

Dedicated webshop, hosting, support and seller product/order administration: PKR 3,000/month or PKR 30,000/year. Domain registration: PKR 4,200 for two years, separate. Dedicated webshops have no marketplace commission; action.pk marketplace selling carries a separate 20% sales commission. Third-party charges are not represented as included.

## Recovery provenance

Source recovered from the recorded file creation and subsequent edits in the cloud chat “Set up ictmates-website”. The original ZIP links were not downloadable from its shared page. The dependency lockfile and upload archives were regenerated locally; they are not byte-identical downloads of the original artifacts. The original design's logo asset was copied read-only from its existing server backup location.

The recovered Astro 5.18.2 baseline is preserved locally in `artifacts/ictmates-recovered-original-source-astro5.zip` and `artifacts/ictmates-recovered-original-siteground-astro5.zip`. The working copy was then upgraded to Astro 7.4.0, with HTML whitespace compression kept compatible with the recovered design. Local recovery evidence, file hashes, baseline archives and deployment records are in the ignored `recovery/` and `artifacts/` directories; they are not needed to build the website from this repository.

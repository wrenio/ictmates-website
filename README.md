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

No production files were changed during recovery. Deploy only when explicitly requested. The deployable output is the **contents** of `dist/`, also packaged as `artifacts/ictmates-siteground.zip`.

Before launch, inventory the existing WordPress URLs and configure redirects for any pages being replaced. The current implementation is a single marketing page, not a migration of the existing blog or portfolio. Confirm the displayed phone number, commercial terms, domain-registration offer and demo destination. The WC demo is a temporary test site and should be updated when its production destination is available.

## Content and interactions

- Edit copy and pricing in `src/pages/index.astro`.
- Edit the visual design in `src/styles/global.css`.
- Pricing buttons lead to the contact section and identify the selected plan.
- The contact button opens a telephone call. No form submission or checkout is implemented.
- The storefront in the hero is an original CSS illustration, not a screenshot or promise of a specific theme.
- No subscription is purchased and no seller account is created on this marketing site.

## Current commercial offer

Dedicated webshop, hosting, support and seller product/order administration: PKR 3,000/month or PKR 30,000/year. Domain registration: PKR 4,200 for two years, separate. Dedicated webshops have no marketplace commission; action.pk marketplace selling carries a separate 20% sales commission. Third-party charges are not represented as included.

## Recovery provenance

Source recovered from the recorded file creation and subsequent edits in the cloud chat “Set up ictmates-website”. The original ZIP links were not downloadable from its shared page. The dependency lockfile and upload archives were regenerated locally; they are not byte-identical downloads of the original artifacts. The original design's logo asset was copied read-only from its existing server backup location.

The recovered Astro 5.18.2 baseline is preserved locally in `artifacts/ictmates-recovered-original-source-astro5.zip` and `artifacts/ictmates-recovered-original-siteground-astro5.zip`. The working copy was then upgraded to Astro 7.4.0, with HTML whitespace compression kept compatible with the recovered design. Local recovery evidence, file hashes, baseline archives and deployment records are in the ignored `recovery/` and `artifacts/` directories; they are not needed to build the website from this repository.

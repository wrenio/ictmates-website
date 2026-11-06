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

### Webstore.pk

The separate Webstore.pk marketing website is in `webstore/`. It reuses the existing
Astro dependency and copies the ICTmates design as its starting point. From the
project root in PowerShell, set `$env:ASTRO_TELEMETRY_DISABLED = '1'`, then run
`npm run dev:webstore` for the local preview at `http://127.0.0.1:4322`.
`npm run build:webstore` generates `webstore/dist/`; `npm run preview:webstore`
serves that build. The existing ICTmates build and deployment remain separate.

The `/partners/` page includes required name, business/creator, city, phone and partner-type fields, plus optional email, in its
enquiry form. Visitors can send an email through Web3Forms or prepare a WhatsApp
message to review before opening WhatsApp. Editing the fields clears the prepared
WhatsApp link until the message is regenerated. No enquiry is stored by this site.

To enable email delivery locally, create `webstore/.env.local` (ignored by Git) with
`PUBLIC_WEB3FORMS_ACCESS_KEY=your_access_key`, using a Web3Forms key linked to the
intended receiving inbox. Restart the dev server after configuring it; static
builds require the key at build time. This is a public form access key, rendered
into the page as intended by Web3Forms, not an email password or private API token.
Without a key, email submission stays disabled and WhatsApp remains available.
With a key, clicking Send enquiry by email makes a real Web3Forms request even on
localhost. Optional visitor email is used for replies; phone remains required.
The form keeps entered details on failure and reports success only after API
confirmation. Inbox receipt must still be checked when activating the connection.

The homepage contact form uses the same Web3Forms key and offers WhatsApp as an
alternative. It collects name, business, city and phone, with optional email and
message. Pricing buttons select the monthly or annual plan in the form; both
email and WhatsApp enquiries include that preference. Homepage email enquiries
use the subject `Webstore.pk webshop enquiry` to distinguish them from partners.

Webstore.pk uses its own SiteGround account, document root
`/home/customer/www/webstore.pk/public_html`, and GitHub environment
`webstore-production`, restricted to `main`. The workflow
`.github/workflows/deploy-webstore.yml` builds `webstore/dist`, runs deployment
protection tests, packages checksummed static files, publishes through the
forced-command receiver, flushes SiteGround caching, and verifies all generated
pages and assets on both `webstore.pk` and `www.webstore.pk`.

The environment contains `SITEGROUND_DEPLOY_KEY` (a dedicated Webstore-only key)
and `PUBLIC_WEB3FORMS_ACCESS_KEY` (the public form key linked to the approved
receiving inbox). The SSH host is pinned in `ops/webstore_siteground_known_hosts`.
The installed receiver must match `ops/deploy_webstore_receiver.py`. It lives at
`/home/customer/.webstore-deploy/deploy_receiver.py`; overwritten files and
receipts are retained outside the web root under the same state directory.
The existing `Default.html`, `.well-known`, and other unmanaged files are preserved.
A protected folder that does not exist is recorded as absent and must remain so.
The independent ICTmates receiver and its destination are unchanged.

Public homepage and partner pages permit indexing and are listed in `sitemap.xml`.
The `/login/` page provides store-access guidance and remains excluded from indexing;
each client receives its own admin URL. It does not implement authentication.
The final supplied WebP logo is unchanged; the page pairs ICTmates blue with teal accents.

Cloudflare should proxy only the marketing apex and www records for this release,
with Full (strict) TLS, HTTPS redirection, and HTTP/3. Use normal static-asset caching
and leave HTML uncached so enquiry pages and releases appear immediately without
a cache-purge credential. Do not enable a zone-wide Cache Everything rule or apply
marketing rules to client subdomains. CSS and JavaScript build filenames are hashed;
version image/font filenames when changing their contents, or purge the changed URLs.

### ICTmates

```sh
export ASTRO_TELEMETRY_DISABLED=1
npm run build
npm run preview
```

The static website is generated in `dist/`. There is no application server or database required for deployment. DM Sans and Manrope are served locally as variable WOFF2 fonts from `public/fonts/`, with early preloads and system fallbacks while loading. The Latin subsets retain the site's existing font weights; their SIL Open Font License files are included alongside them. No Google Fonts requests are needed at runtime.

## SiteGround deployment

The saved Windows SSH connection is `sg_ictmates`. The intended document root is `/home/customer/www/ictmates.com/public_html/`. The old WordPress installation has already been moved into `WP old website` as a backup and is outside this project's scope. Leave that backup untouched.

No production files were changed during recovery. Automatic deployment from `main` is now configured as described below. The deployable output is the **contents** of `dist/`, also packaged locally as `artifacts/ictmates-siteground.zip`.

### Automatic deployment

Every push to `main` runs [Deploy website to SiteGround](https://github.com/wrenio/ictmates-website/actions/workflows/deploy-siteground.yml). It can also be rerun manually with **Run workflow** on `main`. No manual approval is required. Other branches do not deploy.

The workflow runs deployment protection tests, installs the locked dependencies with `npm ci`, builds with Node.js 24, and packages only generated static files. Deployments are serialized so one release cannot interrupt another. The receiver flushes SiteGround's dynamic cache and verifies both HTTPS homepages. The workflow then purges the public HTML URLs from Cloudflare and verifies both pages on both hostnames against the build.

### Cloudflare and SiteGround caching

The Cloudflare rule `ICTmates public marketing pages` is limited to HTTPS requests for `/`, `/index.html`, `/why-wrenio`, `/why-wrenio/` and `/why-wrenio/index.html` on `ictmates.com` and `www.ictmates.com`. Requests with cookies or query strings, and the receiver's exact `ICTMates-Deployment-Verification/1.0` user agent, do not match. The verification exception lets the receiver check fresh origin content before the subsequent Cloudflare purge; it grants no access to private content. Do not add an HTTP-method filter to this rule: Cloudflare URL purges use an internal method, so a GET/HEAD-only expression can leave stale HTML cached even when the purge API reports success. Cloudflare itself only caches eligible read requests.

The rule uses a two-hour edge TTL, bypasses browser caching for HTML, and does not store HTTP responses with status 400 or higher. Fonts and hashed CSS use normal static-asset caching; version font filenames when replacing their contents. The rule does not apply to the old WordPress backup, `.well-known`, other paths or other subdomains.

The GitHub `production` environment requires `CLOUDFLARE_CACHE_PURGE_TOKEN`, with only **Zone > Cache Purge > Purge** permission for **ictmates.com**. The workflow checks that the secret exists before publishing. Its purge targets only the listed HTML URLs on both hostnames, not the entire zone. Public HTML verification removes only Cloudflare's recognized Web Analytics beacon before comparing checksums, since automatic injection can differ by visitor region; origin verification remains byte-for-byte. A failed purge or mismatching public page fails the release workflow; do not report the release as verified until it succeeds.

The two cache layers can coexist. The important order is **publish files → flush SiteGround → verify origin → purge Cloudflare → verify public pages**. Purging only SiteGround leaves Cloudflare's previous HTML intact; purging Cloudflare first can refill it from stale SiteGround content. Do not enable a second CDN or disable SiteGround caching for this static site. If a manual cache refresh is necessary, use Site Tools > Speed > Caching > Dynamic Cache first, then Cloudflare > Caching > Configuration > Custom Purge for the affected URLs on both hostnames.

### Deployment access

A dedicated key is stored in the GitHub `production` environment as `SITEGROUND_DEPLOY_KEY`, restricted to the `main` branch. The runner creates its own `sg_ictmates` SSH alias and verifies the pinned ED25519 host key in `ops/siteground_known_hosts`. Your Windows personal key is not stored in GitHub.

On SiteGround, the key is restricted to `/home/customer/.ictmates-deploy/deploy_receiver.py`; it cannot run arbitrary shell commands or forward connections. The receiver rejects protected paths, hidden paths, traversal, symlinks, and executable server-side files. It publishes assets before `index.html`, retains older hashed assets, and never recursively synchronizes or deletes website directories. `WP old website`, `.well-known`, and unrelated files are preserved. Before/after metadata checks cover the protected directories.

The installed receiver must match `ops/deploy_receiver.py` in the checkout; the workflow fails safely if these differ. A receiver update requires installing the reviewed script using the owner's existing SSH connection. Previous overwritten static files and deployment receipts are retained outside the web root under `/home/customer/.ictmates-deploy/releases/`.

To revoke automatic SSH access, remove only the `ictmates-github-actions` key line from SiteGround's `/home/customer/.ssh/authorized_keys2` and remove the GitHub environment secret. Preserve the other registered keys. To pause automatic deployment without changing keys, disable this workflow in GitHub Actions.

Before launch, inventory the existing WordPress URLs and configure redirects for any pages being replaced. The current implementation is a single marketing page, not a migration of the existing blog or portfolio. Confirm the displayed phone number, commercial terms, domain-registration offer and demo destination. The WC demo is a temporary test site and should be updated when its production destination is available.

## Content and interactions

- Edit copy and pricing in `src/pages/index.astro`.
- The customer comparison page is `src/pages/why-wrenio.astro`, published at `/why-wrenio/` and linked from the homepage navigation and footer.
- The one-page A4 customer flyer is served from `public/downloads/wrenio-commerce-flyer.pdf`. Keep its offer and comparison assumptions aligned with the comparison page.
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

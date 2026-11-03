# AGENTS.md — ICTmates website

Build and maintain the ICTmates and Wrenio Commerce marketing website. The owner
decides scope, commercial offers and releases. Optimize for fast, focused delivery.

## 1. Read only what the task needs

- This file contains working rules. `README.md` contains setup and deployment details.
- Inspect the relevant source and `package.json` before changing behavior. Source and
  workflow configuration describe the implementation; historical README statements
  are not new tasks or proof of the current live state.
- Do not scan `node_modules/`, `dist/`, `.astro/`, `recovery/`, `artifacts/` or
  `.recovery-npm-cache/` unless the task specifically needs them.
- This is a separate website project. Do not modify the Wrenio Commerce repository
  or import its backend, release procedures or review requirements into this site.

## 2. Fast development, tight scope

- Start with a brief statement of the requested outcome and how it will be checked.
  For a small edit, one sentence is enough; no formal plan or approval ceremony.
- Make the smallest complete change using the existing files and patterns. Avoid
  new dependencies, abstractions, scripts or infrastructure for routine work.
- Continue autonomously through reversible local work. Ask only for missing business
  decisions, destructive actions or a release that has not already been authorized.
- Preserve unrelated owner changes. Inspect the working tree before editing; never
  discard work, force-push or rewrite history without explicit authorization.
- Handle small tasks directly. Do not create extra checkouts, worktrees or helpers
  for routine edits. Use `codex/<short-name>` if a task branch is needed.
- Keep formatting changes local. Existing Astro markup and CSS include long compact
  lines; do not reformat an entire file to make a small change.
- Put unrelated findings in one short **Parked** note. Do not investigate or fix them.
- If repeated attempts make no progress, report the concrete blocker and simplest
  next step. Do not create a new toolchain to work around an unrelated failure.
- Stop when the requested outcome is verified. No follow-on audits, cleanup,
  dependency upgrades, speculative hardening or repeated checks without a reason.

## 3. Project map and conventions

| Path | Purpose |
| --- | --- |
| `src/pages/index.astro` | Homepage, offers, FAQs, plan selection and WhatsApp interaction |
| `src/pages/why-wrenio.astro` | `/why-wrenio/` comparison page, including its page-specific styles |
| `src/styles/global.css` | Shared design, typography, responsive layouts and reduced-motion rules |
| `public/` | Logos, favicons and other assets copied directly into the build |
| `public/downloads/wrenio-commerce-flyer.pdf` | Downloadable customer flyer |
| `astro.config.mjs` | Canonical site URL, static output and HTML compression |
| `ops/build_release.py` | Packages generated files with a checksum manifest |
| `ops/deploy_receiver.py` | Restricted SiteGround deployment receiver |
| `ops/siteground_known_hosts` | Pinned SSH host identity |
| `tests/test_deploy_receiver.py` | Deployment protection and publishing tests |
| `.github/workflows/deploy-siteground.yml` | Build, package and production deployment |

- Astro 7.4.0, ESM, static HTML/CSS and small native browser scripts. There is no
  application server, database, checkout or account creation in this project.
- Extend Astro pages and existing CSS. Do not add a UI framework for small interactions.
- Preserve the existing blue palette, CSS illustration, responsive layouts, semantic
  markup, keyboard access, image alternatives and reduced-motion behavior.
- Preserve canonical URLs and section anchors when editing navigation. External links
  opened in a new tab use `rel="noopener noreferrer"`.
- Pricing buttons select a plan and prefill a WhatsApp link; opening the link does
  not send a message. Do not introduce automatic messages or purchases.
- When the owner changes an offer, keep affected homepage copy, comparison content,
  WhatsApp text and flyer consistent. Do not invent prices, claims or contact details.
- Edit source files, not generated `dist/` or `.astro/` output. Keep the lockfile in
  sync only when dependencies intentionally change.

## 4. Commands and proportionate checks

Use PowerShell from the project root. README specifies Node.js 22.22 or newer;
deployment uses Node.js 24. Set `$env:ASTRO_TELEMETRY_DISABLED = '1'` for Astro commands.

| Command | When to use |
| --- | --- |
| `npm ci` | Initial setup, missing dependencies or a changed lockfile; not every task |
| `npm run dev` | Local development and browser preview |
| `npm run build` | Verify changed site source or build configuration; writes `dist/` |
| `npm run preview` | Inspect the generated build when needed |
| `python -m unittest discover -s tests -v` | Changes to deployment, packaging or deployment tests |

- Documentation-only edits: read back the change and check the diff; no site build.
- Site edits: build once after the final change. For layout or interaction changes,
  inspect the affected page at desktop and mobile widths and exercise changed controls.
  Shared CSS changes may affect both pages. Report if browser verification is unavailable.
- Deployment edits: run the existing Python tests and inspect the affected workflow.
  These tests are also mandatory in CI before deployment.
- There are no configured lint, typecheck or frontend test scripts. Do not claim
  `npm test` or `npm run check` exists, or install tooling merely to validate a minor edit.
- Never report a build, test, browser check or deployment that did not actually run.

## 5. Production boundary

- **Every push to `main` deploys to production automatically.** Manual workflow
  dispatch on `main` also deploys. Other branches do not deploy. A local build is safe.
- A request to edit or preview is not permission to publish. Push or merge to `main`
  only when the owner has authorized that release; do not ask again if already authorized.
- Use the existing GitHub Actions deployment route. Read the README deployment section
  for release work; do not invent a parallel uploader or recursive sync command.
- Keep the restricted receiver, checksum checks, pinned host key, serialized deployments
  and protected-path checks intact. Receiver changes also require updating the installed
  server copy through the documented SSH route; a source change alone is insufficient.
- Never delete or modify `WP old website`, `.well-known` or unrelated server files.
  Do not touch backups, DNS, SSH configuration or server infrastructure for a site edit.
- Do not expose or commit credentials, private keys, `.env` files or customer data.
  Keep generated archives and recovery evidence in their existing ignored locations;
  do not add dated task logs or receipts to source control.
- Update README only when behavior, setup or deployment instructions actually change.

## 6. Communication and shortcuts

- Keep updates short: visible outcome, actual check, blocker or decision. Do not ask
  the owner to run routine commands that the agent can run.
- Finish normal tasks with **Done**, **Checked by**, **Parked** (or "none") and
  **Needs you** (or "nothing"). Keep each to one short line where possible.
- `zebra`: when a message consists of or ends with this signal, reply only `✓` and
  hold its instructions. Accumulate consecutive zebra messages without starting their
  work. When a message does not end with zebra, handle the accumulated batch together,
  applying the latest corrections. Mentioning the shortcut in prose is not a trigger.
- `status`: current task, last completed step, next step and blockers.
- `scope`: requested outcome, completion check and parked items in three short lines.

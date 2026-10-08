# Deployment

## Current status — 6 October 2026

**Published and verified:** [live demonstration](https://marsupil.github.io/ecole-peyrieu/) · [dedicated public repository](https://github.com/MarsupiL/ecole-peyrieu) · [successful verification and deployment run](https://github.com/MarsupiL/ecole-peyrieu/actions/runs/37425469373).

The initial deployed source is commit `4bf2bed148d2120a5abc05bd204abc98f8272a49`. GitHub's Ubuntu runner passed lint, 30 domain tests, TypeScript/build and 19 Chromium browser tests before deploying. All 53 uploaded source files matched the locally verified project, and all 15 files fetched from the HTTPS site matched the local production build byte for byte. A fresh isolated browser verified hosted French/English UI, local submission persistence, a PDF receipt download, a denied protected deep link and offline reload under the activated service worker. Its 30 requests were same-origin reads; no external or write requests and no page errors occurred.

Pages uses **GitHub Actions**. The local `app/` repository tracks `origin/main` at the dedicated repository. The source was published through the signed-in GitHub browser because the connector lacked write access. No existing repository visibility was changed. Future updates can use an authenticated Git push or the repository's normal web editor/upload controls.

Only the dedicated `app` directory is prepared for publication. Do not upload its parent workspace, the personal requirements/handoff file, unrelated projects, browser databases, local test artifacts or credentials. No paid service or purchased domain is needed for this static fictional-data demo.

## URL rename — 6 October 2026

The repository is now `MarsupiL/ecole-peyrieu`, serving `/ecole-peyrieu/`. The former Pages path `/peyrieu-school-demo/` is not automatically redirected by GitHub; update bookmarks and use the new address for installation. GitHub repository links redirect to the renamed repository. The IndexedDB name, local-storage keys, calendar UIDs and manifest identifier remain unchanged. New offline caches use `ecole-peyrieu-`, so activating this build does not delete caches used by old-path installations. Existing installed shortcuts may continue to launch the old address; physical launcher migration has not been verified.

## Recreate the deployment in another dedicated repository

1. Create a new repository named `ecole-peyrieu` in the verified account. Select visibility appropriate to the actual plan; a public repository is the default free-account route. Do not make an existing private repository public or use an account's root-site repository.
2. Grant the GitHub connection access to this new repository, or authenticate Git locally using your normal user-controlled flow. Never paste tokens into source files or this README.
3. Commit and push **this app directory only** to its `main` branch. `.gitignore` excludes dependencies, build output, browser reports, generated TypeScript state and local configuration.
4. In the new repository's **Settings → Pages**, choose **GitHub Actions** as the build/deployment source. Run the included `Verify and deploy demonstration` workflow.
5. Open the deployment URL reported by the successful workflow, normally `https://<verified-owner>.github.io/ecole-peyrieu/`. Verify the real URL instead of treating this example as an existing site.

`.github/workflows/pages.yml` installs from the lockfile, runs `npm run check` (lint, unused-code analysis, test/config typechecking, coverage gates and build), installs Chromium/Firefox/WebKit and runs production browser/accessibility/update tests. Only a successful non-PR run uploads `dist` and deploys it. Pull requests are verified without deployment. Trusted GitHub actions are pinned to commit SHAs; the workflow uses Node.js 24, read-only source access during verification and Pages/OIDC permissions in deployment.

## Project path and artifacts

`vite.config.ts` and `scripts/build-sw.mjs` both use `/ecole-peyrieu/`. The manifest uses relative `start_url` and `scope`. Hash routes keep deep links compatible with a static host. If changing the project path, update both build settings and the test base URL before rebuilding; deploy a rebuilt artifact, not files manually edited inside `dist`.

`npm run build` produces the complete deployable `dist/` directory. A handoff ZIP next to this application also contains the same contents. Extract it under `/ecole-peyrieu/` on a static HTTPS host, or use the included Pages workflow. Opening `index.html` as a `file:` URL is not a supported launch method. Browser service workers require HTTPS or a localhost development exception.

The bundle contains only app assets and harmless fictional samples. Source maps and browser test traces are not published. It has no configuration secrets or live service API credentials. The initial JavaScript bundle currently includes the full UI and PDF engine; Vite reports a bundle-size advisory. This is a performance improvement opportunity, not a failed build.

## Deployment verification checklist

- Fresh visit: correct French UI, manifest/icons and fictional-data banner; no language switch or English authoring fields; every persona/module works in French.
- Direct URL: open a `#/form/outing` deep link on the project path, and deny `#/evaluation/other-report` as Alice.
- Save a draft, reload, go offline after the worker has activated, and reopen the form. A first visit needs connectivity to download the app and sample assets.
- Download a receipt and an ICS file; verify that URLs stay under the project path.
- Publish a small subsequent build: keep an old tab open, let it detect the waiting worker, save drafts, then use the update button. Do not force reload during a save.
- On real iOS/Android devices, test installation, standalone launch, keyboard/file selection, storage eviction, offline use and permission-dependent notifications. Those physical checks have not been performed.
- Check the public sample feed with a separate test calendar if desired. Do not import fictional events into a real personal calendar without a deliberate choice. Local edits cannot alter the public static feed.

## Maintenance

Build a new version from the lockfile and publish the complete artifact. The worker waits for explicit user activation and clears only caches prefixed `ecole-peyrieu-`; it leaves IndexedDB intact. Future schema changes need explicit migration logic and tests. Do not repurpose this demo storage as a live school database. A local reset is the supported clean-demo recovery path.

References checked during implementation: [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Vite static deployment](https://vite.dev/guide/static-deploy.html), [WebKit Home Screen web push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

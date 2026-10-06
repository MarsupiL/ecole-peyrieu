# Implementation acceptance report

Date: **6 October 2026**. Build: app v1.0.0, schema 1. Test environment: macOS, Node.js, bundled Playwright Chromium, production Vite output served at `/peyrieu-school-demo/`.

## Recorded results

- `npm run lint`: passed; no ESLint errors.
- `npm test`: **30 domain tests passed**.
- TypeScript compilation and `npm run build`: passed. Vite emitted a bundle-size advisory for the eagerly loaded full UI/PDF engine; no build failure.
- `npm run test:e2e`: **19 production browser tests passed**. Each journey has an isolated browser context. The main journeys pin the clock to 6 October 2026; the seed starts that school week.
- Axe checks: no violations for the tested home page, annual form and form editor with WCAG 2/2.1/2.2 A/AA tags. This is bounded automated evidence, not full accessibility certification.
- Desktop and 390-pixel mobile screenshots inspected. Tested pages have no horizontal overflow; keyboard skip link/dialog interaction and 200% text-size checks pass.
- Generated French form-receipt PDF rendered and visually inspected: readable text, French accents, page layout and demonstration/no-signature footer. PDFs are actual downloadable documents; uploaded filenames survive submission/review.
- ICS parsed with `ical.js`: stable UID, revision/status, exclusive all-day end date, escaped/folded UTF-8 content, correct UTC instants and weekly Paris wall time across the October daylight-saving transition.
- Offline form submission and a real two-version service-worker update tested. The new worker waits for explicit activation, preserves a saved draft and replaces only its own app cache.
- Dependency installation reported no known audit vulnerabilities at implementation time. This is a point-in-time package check, not an application security assessment.

Artifacts from the latest browser run are local in `test-results/` and `playwright-report/`. They are ignored by Git and excluded from deployment. The HTML report can be opened with `npx playwright show-report`. Source evidence is in `tests/domain.test.ts`, `tests/e2e/journeys.spec.ts` and `tests/e2e/update.spec.ts`.

## Acceptance matrix

“Passed” below means the indicated local-demo rule/journey was checked. “Simulated” means the agreed local counterpart works, with no external action. “Not tested” means the external/physical portion remains unverified.

| ID   | Result                                                    | Evidence and boundary                                                                                                                                                                                                                                   |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC01 | Passed                                                    | FR default, every role-family navigated in English and switched back; locale/state reload, draft persistence and local reset journeys. Reset clears both state and file stores.                                                                         |
| AC02 | Passed                                                    | Policy tests deduplicate siblings and deny unrelated classes; home/agenda scoped lists and child filters; desktop/mobile inspection.                                                                                                                    |
| AC03 | Passed                                                    | Known report/evidence/photo IDs denied in browser; policy tests cover revoked lists, direct records, files, exports and notices. These are demo policies, not server security.                                                                          |
| AC04 | Passed                                                    | Scoped authoring policies and live editor publish journey; private reply from an announcement; other guardian denied the private conversation.                                                                                                          |
| AC05 | Passed / simulated                                        | Explicit-participant message journey, excluded co-guardian, quiet-hours queue and reply-notification domain tests. No remote sending.                                                                                                                   |
| AC06 | Passed / simulated                                        | Nora assigns/replies, Sam reads the team response, transport persona denied; captured control values persist through the async save queue.                                                                                                              |
| AC07 | Passed                                                    | Editable template/recipient preview/publication browser journey; domain checks for required and conditional fields; saved drafts and offline form submission.                                                                                           |
| AC08 | Passed                                                    | Submission snapshot survives profile changes; only original submitter may revise; prior answers retained in history; co-guardian sees shared response but cannot overwrite.                                                                             |
| AC09 | Passed / simulated                                        | Deadline/ownership rules and staff reopen checks; legacy-form reopen browser journey; correction/review actions and recipient progress implemented. Reminder delivery is local.                                                                         |
| AC10 | Passed                                                    | PDF upload, filename preservation, staff retrieval, actual PDF receipt download/render; domain rejects invalid MIME/signature/size. Repository stores blobs locally.                                                                                    |
| AC11 | Passed                                                    | Profile edit records a pending care task without replacing reviewed instructions; authorised review promotes it; unrelated reviewer denied. Evidence policy and known-ID browser checks isolate confidential files.                                     |
| AC12 | Passed                                                    | Exact-purpose consent tests cover refused/missing permissions, all guardians and class-vs-school mismatch; scheduled publication rechecks consent.                                                                                                      |
| AC13 | Passed / simulated                                        | Browser withdrawal hides the published illustration and denies its file route; domain checks affected asset access and review task. Public fictional sample/copies cannot be revoked from a static bundle.                                              |
| AC14 | Passed                                                    | Draft report denied to parent, published by teacher, then readable to eligible family. Domain denies unrelated staff/service roles. Review/return/approve controls are implemented.                                                                     |
| AC15 | Passed                                                    | Both guardians open and independently acknowledge; teacher sees separate opened/acknowledged states.                                                                                                                                                    |
| AC16 | Passed / simulated                                        | Representative creates a reviewed staff summary; staff reads it and is denied the original parent topic. Class membership/mandate policy tests cover representative scope. Topic creation and moderation share validated authoring/message transitions. |
| AC17 | Passed                                                    | Anonymous adult response with siblings is unique; repeated answer revises the existing unit; child-unit shared ownership enforced.                                                                                                                      |
| AC18 | Passed / simulated                                        | Organiser results/audit redact answer identity and response capability; mode/options/audience locked after responses. Browser verifies review before summary publication. Full local storage remains inspectable.                                       |
| AC19 | Passed / simulated                                        | Separate school/service acknowledgements and collection confirmation; related bookings remain unchanged. No real operational request sent.                                                                                                              |
| AC20 | Passed                                                    | RSVP, volunteer signup, authorised event edit/cancel and ICS download browser journey; capacity/state/UID/sequence/DST/UTF-8/all-day rules covered in domain/parser checks. Real calendar-app import not performed.                                     |
| AC21 | Passed / simulated                                        | Public sample feed and explanation present; personal token create/revoke journey passes. No private feed service and no synchronization of local edits to the public file.                                                                              |
| AC22 | Passed / simulated                                        | Request → confirmed → cancellation requested → cancelled browser journey and real PDF receipt. Domain checks full/cut-off/capacity states. No Mon Espace Famille operation or payment.                                                                  |
| AC23 | Passed / simulated                                        | Quiet-hour queues, deduplicated reminders, notification attribution and incomplete response checks in domain tests; preferences persist in browser. Closed-app delivery not provided.                                                                   |
| AC24 | Passed locally / physical checks not tested               | Manifest/scope/assets and offline production form flow verified. Two-version worker test verifies explicit update and draft/cache preservation. Physical Home Screen installation/launch and device notifications not tested.                           |
| AC25 | Passed for tested surfaces / specialist review not tested | Axe on home/form/editor, desktop/mobile inspection, no clipping on key details, keyboard checks and 200% text-size test. No VoiceOver/TalkBack/NVDA or comprehensive device/accessibility audit.                                                        |
| AC26 | Passed                                                    | Revocation, representative expiry and rollover domain tests; changing Louise's class in admin immediately denies the former class post.                                                                                                                 |
| AC27 | Passed locally / remote deployment not tested             | Actual production project path, deep routes, offline and update suite pass. Pinned GitHub Actions workflow prepared. No repository permission, remote CI execution or public Pages deployment yet.                                                      |
| AC28 | Passed local review / hosted review not tested            | Fictional seed/public assets, no analytics or outbound submission endpoints in source; uploads in IndexedDB; reset tests; deploy artifact excludes personal handoff and local reports. Public-host inspection waits for deployment.                     |
| AC29 | Passed / simulated                                        | Local feedback creation/export/reset browser journey; no recipient or network transmission.                                                                                                                                                             |
| AC30 | Passed local inventory                                    | All modules are reachable under five role families in both locales without runtime errors; broad domain/browser journeys above exercise the connected workflows. External counterparts remain explicitly simulated.                                     |

## Reproduce

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

Playwright starts/reuses the local production preview. The update test uses a separate ephemeral localhost server and two worker versions of the production bundle; it does not overwrite the build or interfere with another app. CI installs Chromium's Linux dependencies before the same browser suite.

## Remaining checks and limitations

- Publishing requires access to a new dedicated GitHub repository and enabling Pages with Actions. The identity lookup alone is insufficient. No remote CI or live URL is claimed.
- Physical iPhone/Android install, standalone behavior, browser storage pressure/eviction, background lifecycle and optional device notification permission/delivery remain unverified.
- External calendar import/subscription refresh remains unverified. Parser evidence is not a claim that every calendar provider treats replacement imports identically.
- Chrome/Chromium is tested; Safari and Firefox and assistive-technology walkthroughs remain untested. The app includes semantic controls, visible focus, reduced motion and print styling, but does not claim complete accessibility conformance.
- Only explicit local user actions and the demo clock advance workflows. No simultaneous multi-user editing, cross-tab conflict resolution, live account authentication, background server scheduler or remote delivery is represented as working.
- A saved draft survives reload/update. Unsaved editor/form changes must be saved before closing. Save failures preserve the current input and show an error; unexpected browser storage eviction can still remove local data.
- Browser authorization, local confidential-file gating and anonymous-organiser views are demonstrators. Production needs server enforcement, genuinely private storage, operator-approved policies and account verification.

The application uses the permitted local-build handoff fallback while repository access is unavailable. No agreed module was replaced by an inert placeholder, and no real school data or signature was used.

# Implementation acceptance report

## Remaining English sample content — 8 October 2026

Removed inline English translations from sample child collectors, messages, representative discussions, collection requests, event locations and automatic photo-review notes. File sizes use French units. Upload controls show French text even in an English-language browser, retaining the native input, labels, keyboard focus and file picker. The sample illustration, two sample PDFs and public calendar feed are also French-only.

Existing stored content upgrades without a reset. Only exact original bilingual strings are replaced, including their prefilled copies; custom wording and slash-separated content remain intact. Original sample files are replaced only when their bytes match the known shipped version. Uploaded or locally replaced files remain untouched; a failed sample fetch is retried on a later load. Stored record IDs, history entries, preferences, class assignments and drafts are preserved.

Lint, TypeScript/build, **56 domain tests** and all **52 Chromium journeys** pass. The four French-language journeys also pass in Firefox and WebKit (eight additional checks). Separate upgrade checks in all three engines verify original stored sample replacement, failed-fetch retry, custom uploads, saved drafts and repeat reloads. Desktop/mobile child details, the illustration and both rendered PDFs were visually reviewed. Internal legacy translation fields remain compatible but are not exposed in the French interface.

## Dropdown menu spacing — 8 October 2026

The profile chooser and all single-select menus now have inset option text, 44 px minimum rows, rounded corners, a subtle shadow, a soft selected state and a checkmark. Long lists scroll within a viewport-limited panel. Closed profile controls have a padded, lightly bordered surface; inactive account statuses use the existing French translations. Table controls retain enough width for their selected labels. Existing native labels, focus, selection events and stored values remain intact.

The enhancement uses CSS `appearance: base-select` behind feature detection. Chromium and the tested WebKit engine render the styled native picker; Firefox retains its native picker. Option padding is also offered to fallback browsers, but OS-controlled popup appearance varies. No JavaScript replacement widget or dependency was added. See [MDN's customizable-select documentation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select).

Lint, TypeScript/build, **54 domain tests** and **50 Chromium journeys** pass. The 12 focus/layout journeys also pass in both Firefox and WebKit (24 additional checks, including the corrected native-picker test rerun). Responsive coverage spans 320, 390, 768, 1024 and 1440 px and 200% text. Browser checks confirmed open-option bounds and padding, scrolling to the last profile, actual pointer selection, keyboard opening/arrow navigation/selection, focus indicators and saved preferences in Chromium/WebKit. Desktop/mobile profile, settings and consent-table screenshots were visually reviewed. Supporting-browser pointer tests now click the actual rendered option; fallback tests retain the native selection API. Physical mobile and assistive-technology walkthroughs remain unverified.

## Parent profile photos — 8 October 2026

Parents, representatives and adults with combined parent/staff roles can now upload, replace and remove their own portrait in Preferences. The direction can manage all adult portraits in Administration. Parent portraits are readable only by their owner and the direction, including direct-file checks. Parents still cannot edit child photos or other adults' photos. Adding a parent role no longer deletes an existing portrait. Earlier parent-photo exclusions documented below describe superseded behavior.

Lint, TypeScript/build, **54 domain tests** and **50 Chromium browser journeys** pass. The two adult/parent photo journeys also pass in Firefox and WebKit (four additional checks). Coverage includes replacement, removal, reload, offline persistence, representative access, direction visibility, unauthorized adult reads/edits, suspended accounts, role changes and mobile Settings reflow/Axe at 320 pixels. Chromium/Firefox verify offline reload; WebKit retains the documented in-app offline check. No storage reset or new default parent portraits are introduced.

## Administration and profile photos — 8 October 2026

Validation: lint, TypeScript/production build, **47 domain tests** and **47 Chromium browser tests** pass. The seven new administration/photo journeys also pass in Firefox and WebKit (**14 additional checks**). Photos survive fresh offline reloads in Chromium and Firefox. The local WebKit runner reports an internal error for offline reload; that branch checks online reload and offline in-app navigation instead. Physical Safari/iOS offline relaunch remains unverified. The Chromium photo journey also verifies reading the previous raw-Blob storage format.

The current source adds scoped pupil management, class transfers, departures/restoration, adult account management, class-specific representative mandates and optional private pupil/staff portraits. Existing schema-1 records remain compatible; no reset is required.

- Domain coverage in `tests/administration.test.ts`: blank creation/import, real date validation, reciprocal verified family links, teacher source-class restrictions, unchanged child records/history across transfer, unassignment versus departure, independent mandate dates, preserved parent access, account revocation, protected administrator access, parent photo exclusion, publication-consent independence and denial of replaced/removed photo files.
- Browser coverage in `tests/e2e/administration.spec.ts`: teacher creation and transfer with destination-teacher access, direction reassignment/archive/restore, class-scoped mandates, valid/invalid upload, staff self-service, parent controls excluded, removal, persistence and offline photos.
- Administration tables/editors checked at 320 and 1440 pixels with full Axe checks. Existing role/module layout coverage now includes teacher administration at 320, 390, 768, 1024 and 1440 pixels. Table and mobile-navigation contrast were corrected; the demonstration banner now has a named landmark.
- New files are stored as typed bytes to avoid WebKit failures when storing canvas-generated Blobs. Existing stored Blobs are still readable with no database reset or version change.
- Only the repository's fictional sample illustration was uploaded in test browser contexts. No real pupil/staff photographs or external image requests were used.
- Photos are browser-local. These tests establish demonstration behavior, not backend authorization, real accounts, physical mobile-camera behavior or formal accessibility certification.

The sections below retain the historical release evidence.

Date: **6 October 2026**. Build: app v1.0.0, schema 1. Test environments: macOS and GitHub Actions Ubuntu, Node.js 24, Playwright Chromium, production Vite output served at `/ecole-peyrieu/`.

## Recorded results

- `npm run lint`: passed; no ESLint errors.
- `npm test`: **38 domain tests passed**.
- TypeScript compilation and `npm run build`: passed. Vite emitted a bundle-size advisory for the eagerly loaded full UI/PDF engine; no build failure.
- `npm run test:e2e`: **40 production browser tests passed**, including 10 design regressions, three messaging journeys, four calendar journeys, two dropdown-focus journeys and two French-only authoring/compatibility journeys added after the initial 19-test release. Each journey has an isolated browser context. The main journeys pin the clock to 6 October 2026; the seed starts that school week.
- Axe checks: no violations for the tested home page, annual form, form editor, populated inbox, month calendar and expanded event panel with WCAG 2/2.1/2.2 A/AA tags. This is bounded automated evidence, not full accessibility certification.
- Desktop and 390-pixel mobile screenshots inspected. Tested pages have no horizontal overflow; keyboard skip link/dialog interaction and 200% text-size checks pass.
- Generated French form-receipt PDF rendered and visually inspected: readable text, French accents, page layout and demonstration/no-signature footer. PDFs are actual downloadable documents; uploaded filenames survive submission/review.
- ICS parsed with `ical.js`: stable UID, revision/status, exclusive all-day end date, escaped/folded UTF-8 content, correct UTC instants and weekly Paris wall time across the October daylight-saving transition.
- Offline form submission and a real two-version service-worker update tested. The new worker waits for explicit activation, preserves a saved draft and replaces only its own app cache.
- [GitHub verification and deployment](https://github.com/MarsupiL/ecole-peyrieu/actions/runs/37425469373) passed the same lint, 30 domain tests, build and 19 browser tests for source commit `4bf2bed148d2120a5abc05bd204abc98f8272a49`.
- [Public HTTPS site](https://marsupil.github.io/ecole-peyrieu/) verified: all 15 served production files matched the local build byte for byte. A fresh isolated hosted browser passed service-worker activation, offline reload, persisted form submission, PDF receipt download, language switching and protected deep-link denial. All 30 observed requests were same-origin reads, with no external/write requests or page errors.
- Dependency installation reported no known audit vulnerabilities at implementation time. This is a point-in-time package check, not an application security assessment.

Artifacts from the latest browser run are local in `test-results/` and `playwright-report/`. They are ignored by Git and excluded from deployment. The HTML report can be opened with `npx playwright show-report`. Source evidence is in `tests/domain.test.ts`, `tests/e2e/journeys.spec.ts` and `tests/e2e/update.spec.ts`.

## Acceptance matrix

“Passed” below means the indicated local-demo rule/journey was checked. “Simulated” means the agreed local counterpart works, with no external action. “Not tested” means the external/physical portion remains unverified.

| ID   | Result                                                    | Evidence and boundary                                                                                                                                                                                                                                   |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC01 | Passed                                                    | French-only interface, every role-family navigated; previous English preferences preserve French content; state reload, draft persistence and local reset journeys. Reset clears both state and file stores.                                            |
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
| AC27 | Passed                                                    | GitHub Actions lint, 30 domain tests, build and 19 browser tests passed before Pages deployment. Actual public project path, deep-link denial, offline reload and downloads verified; all 15 hosted files match the tested build.                       |
| AC28 | Passed for tested local and hosted flows                  | Fictional seed/public assets; uploads in IndexedDB; reset tests; artifact excludes personal handoff and local reports. Hosted smoke test observed only 30 same-origin GET requests, with no external submissions or page errors.                        |
| AC29 | Passed / simulated                                        | Local feedback creation/export/reset browser journey; no recipient or network transmission.                                                                                                                                                             |
| AC30 | Passed local inventory                                    | All modules are reachable in French under five role families without runtime errors; broad domain/browser journeys above exercise the connected workflows. External counterparts remain explicitly simulated.                                           |

## Reproduce

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

Playwright starts/reuses the local production preview. The update test uses a separate ephemeral localhost server and two worker versions of the production bundle; it does not overwrite the build or interfere with another app. CI installs Chromium's Linux dependencies before the same browser suite.

## Design review — 6 October 2026

- Dropdowns have a consistent inset chevron and reserved text space. Form selections can wrap while retaining the underlying native select, accessible label, focus and option-change behavior. The reminder setting spans the card width, and form rows align when labels wrap.
- Home and calendar share vertically stacked month/day badges. Both parts, including the calendar week strip, use Europe/Paris dates. A regression checks the date immediately after midnight at a month boundary.
- Form/card columns adapt to available width; detail columns stack when space or enlarged text requires it. The phone profile selector uses its own row, and calendar toolbar actions align side by side.
- The committed Chromium layout suite covers **330 module/role/width combinations**: 320, 390, 768, 1024 and 1440 pixels; five role personas; French; 13 modules plus director administration. It checks horizontal overflow, control bounds, visible selected values and stacked date geometry.
- Before the French-only simplification, an additional local audit passed **240 combinations in Firefox 155 and 240 in WebKit 26.6**, at 390, 768 and 1440 pixels with parent, director and service personas in both languages. No page overflow, clipped selected labels or runtime errors were detected in those flows. These are desktop browser engines with resized viewports, not physical-device tests.
- Before the French-only simplification, editor dialogs, long wrapped selections, near-midnight dates, 200% text sizing, focus/native option changes and translated visible values passed ten additional checks across Firefox and WebKit. Native OS popup navigation could not be synthesized reliably by the macOS headless runners, including on an unstyled plain select; selection was verified through Playwright's native option API. Existing keyboard navigation and accessibility checks remain in the Chromium suite.
- Screenshots of desktop/tablet/mobile home, calendar, settings, bookings and editor layouts were visually reviewed. Local images remain in ignored `test-results/design/`; they are not deployed.

Source regression coverage is in `tests/e2e/layout.spec.ts`. The original deployment links above record the first release; subsequent pushes run the expanded suite before publication.

## Messaging refinement — 6 October 2026

- Opening **New message** starts with an empty subject and body. A previously saved body is available through an explicit **Restore draft text** action. Contextual replies retain their reference subject; no previous body is inserted automatically.
- Successful sends clear only that sender’s matching composition draft. Failed validation/authorisation preserves the saved draft and current input; other people’s and contextual drafts remain unchanged.
- Conversations appear in one compact list with subject, correspondents/team, latest-message preview, Paris-local date, unread state and relevant closed/resolved status. Rows sort by latest-message timestamp, with most recently created conversations first when timestamps match.
- Search covers accessible subjects, message text and correspondents, ignoring accents, case and surrounding spaces. Team assignment filters and policy-based visibility are preserved. The privacy explanation sits below the list so conversations remain prominent on phones.
- Two domain regressions and three production browser journeys cover draft recovery/send/reopen, validation preservation, unread/read behavior, keyboard opening, search, excluded conversations and service assignment filters.
- A populated 26-conversation fixture checks ordering, long subjects, alignment and overflow at 320, 390, 768 and 1440 pixels in French, plus 200% text and an automated accessibility scan. All three messaging journeys also passed in Firefox and WebKit (six additional local checks). Desktop and phone layouts were visually reviewed.

## Month and list calendar — 6 October 2026

- The agenda opens on the current month using the Europe/Paris date. Only Month and List remain; the twelve-widget Year overview and school-year selector are removed. Month arrows stop at September and August of the current school year, and Today returns to the current month. List includes that school year’s events, independent of the selected month. Reopening or reloading the agenda restores the current month.
- Event dates are highlighted, today is outlined and dates containing only cancelled events use a dashed red treatment. Accessible date labels announce event counts; multiple events on one date share a panel. The panel shows scope, status, description, location and Paris-local times, with a path to the full event and its existing attendance/volunteer controls.
- Weekly events expand to the demo’s four sessions using Paris wall time across DST. Multi-day events mark every covered date; all-day end dates and timed midnight ends remain exclusive. Six domain tests cover school-year/leap-year boundaries, day indexing, spans, recurrence, cancellations and scoped event sets.
- Search and status filters apply to the calendar and list. Upcoming filtering checks each occurrence, so later recurring sessions remain visible. Export includes each matching event/series once, preserving its existing UID and recurrence; it does not flatten a series into duplicate calendar records.
- Four production browser journeys cover month/list navigation, September–August navigation limits, current-month defaults across January and the Paris school-year boundary, keyboard opening/focus restoration, summer dates, recurring/shared dates, cancellation/search/privacy filters and deduplicated ICS export. The list excludes events wholly outside the current school year. All four also passed in Firefox and WebKit (eight additional local checks).
- The dedicated calendar layout check covers both views at 320, 390, 768 and 1440 pixels in French, plus 200% text and automated accessibility scans of the month view and expanded panel. Calendar filters wrap at enlarged text sizes and long list entries reflow. Screenshots of desktop/phone month, list and event-panel layouts were reviewed. These are resized browser engines, not physical devices.

## Dropdown focus — 6 October 2026

- Native dropdowns no longer keep the large orange outline after mouse/touch selection. Pointer origin is tracked only on the selected control; its native focus and selected value remain intact.
- Keyboard navigation restores a 2px blue focus ring. Switching from keyboard to pointer use suppresses it again; leaving the control clears the pointer marker. Controls without a recorded pointer interaction retain the browser’s normal focus-visible behavior.
- Delegated handling covers plain toolbar selects, wrapped form/calendar selects, associated-label activation and dynamically rendered controls. Other control types retain their existing focus styling.
- Two production browser regressions cover actual mouse/touch activation, value changes, retained focus, Tab/Shift+Tab return, associated labels, focus transfer and settings. Both journeys also passed in Firefox and WebKit (four additional checks). Option values are selected with Playwright’s native option API; these tests do not claim to verify every physical OS picker or screen-reader interaction.

## French-only interface — 6 October 2026

- The language switch and duplicate English title/body/question fields are removed. Welcome/loading/error screens use French, and the mobile header no longer reserves an empty language-button column.
- Form options and poll choices use one French label per line. Editing, publishing and reopening preserve complete labels, including spaces and literal `|` characters. Existing bilingual record shapes remain compatible; no stored content or attachments are reset.
- A previously saved English preference no longer changes the interface language. New and existing personas use French content, document language, dates and exports. Historical translated data is retained internally for compatibility and has no separate authoring controls.
- Two new production journeys verify old English preferences, retained local content, French-only form questions and poll choices, publication and reopening. Both journeys and the 390/1024-pixel editor checks also passed in Firefox and WebKit (eight additional local checks). Mobile home and form-editor screenshots were reviewed.
- The complete 40-journey Chromium suite passes, including 330 French module/role/width layouts, expanded text, accessibility, messaging, month/list calendar, focus, offline and safe-update coverage. Earlier bilingual checks documented above describe historical releases; English switching is no longer a product requirement.

## Selected logo — 6 October 2026

- The user selected **Le crayon qui pousse** from four original SVG concepts. The full wordmark replaces the sidebar monogram; the compact mark appears in the phone/desktop header, loading screen and favicon.
- 192/512 px app PNGs are generated from the same compact SVG. A separate 512 px maskable PNG and 180 px Apple touch PNG have opaque navy backgrounds. Their dimensions, manifest references and file formats were checked. Physical launcher/install behavior remains unverified.
- The existing 40-journey production suite passes, including layout, accessibility, offline and safe-update flows. Desktop and phone screenshots were visually reviewed; the final phone header and offline flows were rechecked after a responsive style correction. No additional behavior tests were introduced for this visual change.

## Project URL rename — 6 October 2026

- Build, service-worker scope/assets/notification links, preview/test URLs and documentation use `/ecole-peyrieu/`. The existing 38 domain tests and 40 production browser journeys pass at the new project path.
- The two-version update journey also checks that a legacy-path offline cache is preserved while the current-path cache updates and the saved draft survives.
- A separate local migration check served the previous and new production builds on the same origin, saved a draft through the old URL, then reopened it at the new URL. It verified the retained draft, unchanged app identifier, new manifest start/scope, both cached versions loading offline and no page errors. Physical installed-app shortcut migration remains unverified.

## Fictional profile portraits — 8 October 2026

- Added 19 independently generated portraits: twelve pupils and seven non-parent staff, optimized to 512 × 512 WebP (289 KiB total). The originals are preserved privately; public generation prompts and asset provenance are in `PROFILE_PORTRAITS.md`.
- Existing datasets receive defaults without a reset. Uploaded photos take priority; explicit removals remain removed, including removals saved by earlier releases. New records and all parent accounts retain initials. Display uses current profile scope; these fictional static assets are public fixtures, not private uploads.
- All 51 domain checks pass. Four new checks cover the seeded roster, viewer scope, mixed parent/staff roles, preservation of uploads, remembered default removal and compatibility with historical removal audit records.
- The new browser journey decodes all 19 portraits, verifies parent exclusion, offline display, and pupil/staff default removal after reload. Existing upload journeys now explicitly await a blob URL so a visible default cannot mask an incomplete upload.
- All 48 Chromium journeys pass across the complete run and the corrected save-wait rerun. Eight administration/photo journeys also pass in Firefox and WebKit (16 additional checks), including Axe and reflow at 320 and 1440 pixels. Chromium and Firefox cover fresh offline reload; the WebKit runner covers offline in-app use because of its previously observed offline-reload limitation. Physical mobile installation remains unverified.

## Five class groups — 8 October 2026

- Fresh and existing demo datasets use PS/MS/GS, CP/CE1, CE1/CE2, CE2/CM1 and CM1/CM2. Existing class IDs remain stable. The added CE2/CM1 group starts empty, ready for the direction to assign pupils and staff.
- A one-time stored-data upgrade renames only the original current-year labels, adds the missing group without duplicating a locally created CE2/CM1 class, and leaves custom/archived groups and all pupil, staff, photo, permission and draft records intact. Subsequent loads do not recreate a removed group.
- Lint, TypeScript/build and all 53 domain checks pass. The 49 Chromium journeys pass across the suite and corrected filter-label expectation rerun, including mobile layouts. A dedicated IndexedDB upgrade journey also passes in Firefox and WebKit; it compares every non-class state field and verifies that a previously uploaded photo still loads after the upgrade.

## Remaining checks and limitations

- The public static demo is deployed. The live site is not a school production service; server authentication, private storage and real integrations remain outside its scope.
- Physical iPhone/Android install, standalone behavior, browser storage pressure/eviction, background lifecycle and optional device notification permission/delivery remain unverified.
- External calendar import/subscription refresh remains unverified. Parser evidence is not a claim that every calendar provider treats replacement imports identically.
- Chromium, Firefox and WebKit engines have the bounded coverage described above. Physical Safari/iPhone and Android testing and assistive-technology walkthroughs remain untested. The app includes semantic controls, visible focus, reduced motion and print styling, but does not claim complete accessibility conformance.
- Only explicit local user actions and the demo clock advance workflows. No simultaneous multi-user editing, cross-tab conflict resolution, live account authentication, background server scheduler or remote delivery is represented as working.
- A saved draft survives reload/update. Unsaved editor/form changes must be saved before closing. Save failures preserve the current input and show an error; unexpected browser storage eviction can still remove local data.
- Browser authorization, local confidential-file gating and anonymous-organiser views are demonstrators. Production needs server enforcement, genuinely private storage, operator-approved policies and account verification.

The application is published from its dedicated repository; the local build archive remains available as a portable handoff. No agreed module was replaced by an inert placeholder, and no real school data or signature was used.

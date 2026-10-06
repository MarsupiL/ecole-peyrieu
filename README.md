# Peyrieu School · Demo

A working French/English school PWA with fictional families, children and staff. This is an independent demonstration, not an official school service. Every visitor has a separate local dataset. No messages, school forms, medical files or reservations are transmitted to a remote service.

**[Open the live demonstration](https://marsupil.github.io/peyrieu-school-demo/)** · [Source repository](https://github.com/MarsupiL/peyrieu-school-demo) · [Verified deployment](https://github.com/MarsupiL/peyrieu-school-demo/actions/runs/37425469373)

## Run it

Use Node.js 24 and npm. From this application directory:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, including `/peyrieu-school-demo/`. For the production PWA:

```sh
npm run build
npm run preview
```

Open [the local production demo](http://127.0.0.1:4173/peyrieu-school-demo/). The local server must remain running. The app is designed for the GitHub Pages project path `/peyrieu-school-demo/`; it does not assume ownership of a domain's root.

## Explore the demo

The persistent banner and persona selector identify this as a demonstration. French is the default; the EN/FR control remembers the language for each fictional adult. The first-run guide explains the local boundary. The in-app **Demo guide** gives eight stakeholder walkthroughs and local feedback capture.

| Persona                   | Useful walkthrough                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alice Martin              | Two children in different classes; annual forms, outing response, private messages, care information, photo choices, evaluations and bookings          |
| Thomas Martin             | Separate guardian account; shared submitted forms, private individual form, independent acknowledgements, no automatic access to Alice's conversations |
| Emma Laurent / Hugo Simon | Shared teaching scope; create class publications/forms, review responses, publish evaluations and reply privately                                      |
| Camille Roussel           | Director; school publications, invitations, membership/class changes, CSV import, year rollover, audit, restricted-evidence review                     |
| Nora Dubois / Sam Leroy   | Shared meals/childcare inbox, named handler, service forms, separate absence/collection acknowledgements                                               |
| Alex Rivière              | Transport scope, with no access to the meals/childcare inbox                                                                                           |
| Inès Morel                | Class representative; parent-only topics and polls, moderated discussion, explicitly reviewed summaries to staff                                       |
| Luc Petit                 | An unrelated-class guardian for access-denial checks                                                                                                   |

The seed includes four fictional classes, twelve children, eleven adults, shared-class teachers, siblings, conflicting photo permissions, sample documents, drafts/published reports, forms, polls, events, messages and bookings. Dates start in the week of first use. **Preferences → Demo clock** advances local simulated time to exercise deadlines, quiet hours, reminders and scheduled publication. Reset creates a fresh dataset for the current week.

## Functional scope

- Child-filtered home, scoped lists/search/direct routes, tasks and notifications.
- School/class announcements, pinning/expiry/scheduling, safe sample photos, private replies and explicit conversation participants.
- Shared service inbox with assignment, named messages, attachments, unread state and resolution; separate team absence acknowledgements and confirmed collection requests.
- Seven reusable form templates with editable fields, conditions, scope/recipient preview, private drafts, profile prefill, explicit submission, immutable snapshots/history, owner-only revisions, deadlines, correction flags, reopening, staff processing and recipient progress.
- Practical care updates distinct from previously reviewed instructions, confidential evidence restricted to its uploader and explicitly assigned reviewers, separate per-purpose/per-guardian photo permissions and withdrawal follow-up.
- Evaluation drafting, review, publication, attachments, guardian-specific opened/acknowledged states and PDF report export.
- Identified or anonymous polls, per-adult/per-child units, ownership, deadlines, result exports and reviewed summary publication.
- Representative topics, reporting/moderation, close/reopen and summary-only escalation that does not disclose the original discussion.
- Scoped calendar authoring, changes/cancellations, RSVP, volunteer capacity, all-day and four-week recurring events, ICS downloads, a fixed fictional public feed and simulated personal-feed revocation.
- Local meals/childcare/transport requests, repeat-date preview, example capacity/cut-offs, explicit simulated confirmation/cancellation and PDF receipts. The real Mon Espace Famille portal is a separate external link.
- Invitations and simulated acceptance, verified links/statuses, class/service assignments, validated CSV preview/import, school-year rollover and scoped audit.
- Local uploads/downloads, PDF/CSV/ICS exports, offline operation, explicit update prompt, responsive layouts, keyboard controls and local stakeholder feedback export.

## Local data and boundaries

IndexedDB `peyrieu-school-demo-v1` stores typed state and uploaded file blobs. Local storage keys beginning `peyrieu.` retain the active persona and onboarding choice. A schema/version check protects against accidentally reading an unsupported state. Saves are serialized; storage failures show an error. Save a draft before closing a form/editor. Language changes preserve current form values. Reset clears this app's state and uploaded files, then restores fictional fixtures; it does not clear unrelated websites.

**The persona switcher and browser-side policies demonstrate access rules; they are not authentication or a security boundary.** Someone controlling the browser can inspect the local database and bundled fictional records. Browser data is not an encrypted medical-record store. Use only fictional uploads. Do not enter real pupil, family, health, credential or signature data.

Uploads accept PDF, PNG, JPEG and WebP up to 10 MB after extension, MIME and file-signature checks. These checks do not replace server-side scanning. Files remain in IndexedDB and are exposed through policy-checked UI and short-lived object URLs. Public sample files in `public/` are intentionally harmless and remain accessible in a static bundle even when the app hides a withdrawn photo; the demo cannot revoke copies someone already downloaded.

No live backend, multi-device synchronization, email sender, remote push sender, payment, real reservation, qualified signature or official school integration is included. Anonymous survey answer/identity separation applies to organiser views and exports; it is not anonymity against a person inspecting the complete local database. Optional device notifications require an explicit user action and browser permission. They are not reliable background delivery. The demo clock runs only when advanced in the app.

## Architecture

React + TypeScript + Vite; `idb` for IndexedDB, jsPDF for generated documents, Lucide for icons. Dependencies and CI actions are pinned.

| Location                                 | Responsibility                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `src/domain/types.ts`                    | Typed entities and state schema                                              |
| `src/domain/policy.ts`                   | Central membership, audience, record, file and notification policies         |
| `src/domain/engine.ts`                   | Validated immutable state transitions, history and audit                     |
| `src/domain/exports.ts`, `schoolTime.ts` | Policy-checked PDF/CSV/ICS, file validation and Paris wall-time conversion   |
| `src/data/`                              | Fictional bilingual seed, reusable templates and repository boundary         |
| `src/domain/adapters.ts`                 | Explicit local reservation, notification and calendar integration boundaries |
| `src/ui/`, `src/App.tsx`                 | Role-aware workflows, language, navigation and persistence feedback          |
| `scripts/build-sw.mjs`                   | Content-versioned service worker, limited to the project path                |
| `tests/`                                 | Domain rules, production browser journeys and accessibility checks           |

Single timed calendar events use UTC instants; weekly events include `Europe/Paris` timezone definitions so wall time survives daylight-saving changes. All-day end dates are exclusive. The calendar export is a snapshot. `public/sample-calendar.ics` is a fixed fictional feed; changes in IndexedDB cannot update subscribers' calendars. A simulated `DEMO-ONLY` token has no remote endpoint.

## Verification and handoff

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

The browser suite runs the production build at the actual project subpath. See [the acceptance report](docs/TESTING.md) for results and limits, [deployment instructions](docs/DEPLOYMENT.md) for GitHub Pages, and [staff/data provenance](docs/DATA_PROVENANCE.md) for the fictional roster decision.

Before real use, the operator must establish school sponsorship, current rosters, lawful data/recipient rules, retention, real identity verification, server authorization/private files, staff MFA, hosting/operations, provider-approved booking integration, notification delivery, physical-device testing, accessibility review, and acceptance of administrative/signing workflows. A working demonstration does not establish compliance, certification or permission to handle real records.

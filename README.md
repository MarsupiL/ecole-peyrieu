# Peyrieu School · Demo

A working French-language school PWA with fictional families, children and staff. This is an independent demonstration, not an official school service. Every visitor has a separate local dataset. No messages, school forms, medical files or reservations are transmitted to a remote service.

**[Open the live demonstration](https://marsupil.github.io/ecole-peyrieu/)** · [Source repository](https://github.com/MarsupiL/ecole-peyrieu) · [Verified deployment](https://github.com/MarsupiL/ecole-peyrieu/actions/runs/37425469373)

## Run it

Use Node.js 24 and npm. From this application directory:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, including `/ecole-peyrieu/`. For the production PWA:

```sh
npm run build
npm run preview
```

Open [the local production demo](http://127.0.0.1:4173/ecole-peyrieu/). The local server must remain running. The app is designed for the GitHub Pages project path `/ecole-peyrieu/`; it does not assume ownership of a domain's root.

The project moved from `/peyrieu-school-demo/` to `/ecole-peyrieu/`. Use the new link for bookmarks and future installations; GitHub Pages does not redirect the previous project URL. Existing browser-local data is retained on the same origin, and the app identifier remains unchanged.

## Explore the demo

The persistent banner and persona selector identify this as a demonstration. The interface and authoring fields are French-only; profiles previously saved in English also open in French. The first-run guide explains the local boundary. The in-app **Guide de la démo** gives eight stakeholder walkthroughs and local feedback capture.

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

## Administration and profile photos

Open **Administration** as the direction or a teacher. The direction can invite, edit, suspend or revoke adult accounts; maintain pupil identity, verified parent links, class and service enrolment; archive school departures and restore the same records. Teachers can create/edit pupils in their assigned classes, transfer those pupils to another current class, or remove them from their class for direction reassignment. Removing an adult revokes access; removing a pupil from a class does not delete their school record. Transfers keep the pupil ID, parent links, documents, evaluations and response history.

The **Parents délégués** tab assigns or removes a verified parent's mandate per class, with a separate expiry date for each class. Teachers are restricted to their own classes. Losing a mandate preserves normal parent access; transferring the last linked child out of a class ends that class's mandate.

For a pupil photo, open **Enfants et classes → Modifier**, or the pupil's profile as the direction/assigned teacher. For a staff photo, the direction uses **Adultes et accès → Gérer**; staff can also change their own photo in **Préférences**. Parent accounts, including representatives and accounts combining a parent and staff role, retain initials. New pupil records must be saved before adding a photo.

Photos accept JPEG, PNG or WebP up to 5 MB. The app validates and decodes them, crops the centre to a square, and re-encodes a portrait up to 512 pixels without source metadata. Changes save immediately to this browser's IndexedDB and work offline after initial installation. Replace/remove controls use current profile permissions, including direct-file checks. Profile photos are separate from publication consent and grant no permission to publish a child’s image.

The **Droits et recommandations** tab explains current permissions and suggests temporary staff assignments, verified invitations/MFA, additional validation for sensitive family-link changes and an agreed retention policy for a future real service. These production recommendations remain outside the local fictional demo.

## Functional scope

- Child-filtered home, scoped lists/search/direct routes, tasks and notifications.
- School/class announcements, pinning/expiry/scheduling, safe sample photos, private replies and explicit conversation participants.
- Shared service inbox with assignment, named messages, attachments, unread state and resolution; separate team absence acknowledgements and confirmed collection requests.
- Seven reusable form templates with editable fields, conditions, scope/recipient preview, private drafts, profile prefill, explicit submission, immutable snapshots/history, owner-only revisions, deadlines, correction flags, reopening, staff processing and recipient progress.
- Practical care updates distinct from previously reviewed instructions, confidential evidence restricted to its uploader and explicitly assigned reviewers, separate per-purpose/per-guardian photo permissions and withdrawal follow-up.
- Evaluation drafting, review, publication, attachments, guardian-specific opened/acknowledged states and PDF report export.
- Identified or anonymous polls, per-adult/per-child units, ownership, deadlines, result exports and reviewed summary publication.
- Representative topics, reporting/moderation, close/reopen and summary-only escalation that does not disclose the original discussion.
- Calendar opens on the current Paris month, with month navigation limited to the current September–August school year and a list of that year’s events. Highlighted dates expand into event details. Scoped authoring, changes/cancellations, RSVP, volunteer capacity, all-day/four-week recurring events, ICS downloads, a fixed fictional public feed and simulated personal-feed revocation remain available.
- Local meals/childcare/transport requests, repeat-date preview, example capacity/cut-offs, explicit simulated confirmation/cancellation and PDF receipts. The real Mon Espace Famille portal is a separate external link.
- Invitations and simulated acceptance, verified links/statuses, class/service assignments, validated CSV preview/import, school-year rollover and scoped audit.
- Local uploads/downloads, PDF/CSV/ICS exports, offline operation, explicit update prompt, responsive layouts, keyboard controls and local stakeholder feedback export.

## Local data and boundaries

IndexedDB `peyrieu-school-demo-v1` stores typed state and uploaded file blobs. Local storage keys beginning `peyrieu.` retain the active persona and onboarding choice. A schema/version check protects against accidentally reading an unsupported state. Saves are serialized; storage failures show an error. Save a draft before closing a form/editor. Existing bilingual records remain compatible; stored content is preserved without a data reset. Reset clears this app's state and uploaded files, then restores fictional fixtures; it does not clear unrelated websites.

**The persona switcher and browser-side policies demonstrate access rules; they are not authentication or a security boundary.** Someone controlling the browser can inspect the local database and bundled fictional records. Browser data is not an encrypted medical-record store. Use only fictional uploads. Do not enter real pupil, family, health, credential or signature data.

Uploads accept PDF, PNG, JPEG and WebP up to 10 MB after extension, MIME and file-signature checks. These checks do not replace server-side scanning. Files remain in IndexedDB and are exposed through policy-checked UI and short-lived object URLs. Public sample files in `public/` are intentionally harmless and remain accessible in a static bundle even when the app hides a withdrawn photo; the demo cannot revoke copies someone already downloaded.

No live backend, multi-device synchronization, email sender, remote push sender, payment, real reservation, qualified signature or official school integration is included. Anonymous survey answer/identity separation applies to organiser views and exports; it is not anonymity against a person inspecting the complete local database. Optional device notifications require an explicit user action and browser permission. They are not reliable background delivery. The demo clock runs only when advanced in the app.

## Visual identity

The selected logo is **Le crayon qui pousse**: a pencil with two leaves in the app’s navy, teal and soft gold. `public/logo.svg` is the full wordmark; `public/favicon.svg` is the compact source used in the header and loading screen. Run `node scripts/icons.mjs` from this directory after changing the compact SVG to regenerate the SVG/32 px PNG browser favicons, 192/512 px app icons, opaque maskable icon and 180 px Apple touch icon. HTML, the manifest and notifications use the `crayon` filenames so old icon URLs do not retain the previous identity. Legacy assets remain available for older installations. The service worker includes all icons for offline use. Updating installed launcher icons follows each platform’s own refresh behavior.

## Architecture

React + TypeScript + Vite; `idb` for IndexedDB, jsPDF for generated documents, Lucide for icons. Dependencies and CI actions are pinned.

| Location                                 | Responsibility                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `src/domain/types.ts`                    | Typed entities and state schema                                              |
| `src/domain/policy.ts`                   | Central membership, audience, record, file and notification policies         |
| `src/domain/engine.ts`                   | Validated immutable state transitions, history and audit                     |
| `src/domain/exports.ts`, `schoolTime.ts` | Policy-checked PDF/CSV/ICS, file validation and Paris wall-time conversion   |
| `src/data/`                              | Fictional seed, reusable templates and repository boundary                   |
| `src/domain/adapters.ts`                 | Explicit local reservation, notification and calendar integration boundaries |
| `src/ui/`, `src/App.tsx`                 | Role-aware French workflows, navigation and persistence feedback             |
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

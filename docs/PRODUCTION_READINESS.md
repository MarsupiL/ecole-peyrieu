# Production readiness review

Review date: 8 October 2026. Baseline: `f88cb4467a5b04a3c37acb028bb4e7228228fe1e`.

## Decision

**Suitable for beginning production engineering after the hardening in this review. Not suitable for real pupil, family or health information.** The working product, access rules and regression tests are worth retaining. The browser database and persona selector are demonstration infrastructure; publishing this static build does not turn it into a shared, authenticated school service.

This is a source review and automated verification, not a penetration test, compliance certification or proof that no defects remain. No real accounts, server database, medical records, notification delivery or booking integration were introduced.

## Findings corrected in this review

Severity describes the impact of carrying the old behavior into a connected service; the current deployment contains fictional, locally inspectable data.

| Priority | Finding and reproducible consequence | Correction and evidence |
| --- | --- | --- |
| P1 | Two tabs loaded the same revision; the later save silently replaced the first tab's changes. Concurrent initialization could also create different seeds. | IndexedDB compares the expected revision inside the write transaction. One competing write succeeds; the other is rejected with a French recovery message and its form input stays visible. Initialization is shared within an instance and retried against a winning tab. Unit tests and a browser test in all three engines exercise this. |
| P1 | Attachment bytes were written before their metadata. Failed saves left orphan bytes; profile replacement/deletion cleanup ran separately. | State, newly uploaded bytes and removal of replaced portrait bytes commit in one transaction. Network fetches and Blob conversion happen before the transaction. Tests inject storage failure, check rollback, and reject stale uploads. |
| P1 | Storage was cast directly to `State`, checking only `schema`. Damaged records could break rendering or produce inconsistent relationships. | Runtime schema validation covers every stored entity shape, key relationships and uniqueness checks. Unsupported/damaged state fails closed and remains intact; reset requires an explicit action. Unknown additional fields are preserved, not silently stripped. |
| P1 | Representative topic drafts bypassed the normal draft-read rule; scheduled evaluations could be read as published reports. | Hidden publication states require the appropriate management/reviewer scope. Regression tests assert ordinary parents cannot read them. |
| P1 | A responsible staff member could call `reviewSubmission` on a private parent draft even though the read policy hid that draft. | The command rejects draft processing and mutations to archived/previous-year responses. Archived discussions also reject new replies. A failing-before/fixed-after domain regression covers the boundary. |
| P1 | Preference/profile commands used unrestricted `Object.assign`; extra runtime properties could change roles or family links despite TypeScript's parameter types. | The editable keys are allowlisted, preference values are checked, and inputs are cloned. Tests attempt role/link injection. This does not constitute a complete future API validator: see P1 work below. |
| P1 | Year rollover relabelled the existing class records with the next year, losing their original year identity. | Old current classes become archived records; new classes receive new IDs. Active pupils are assigned to the corresponding new class with stable pupil IDs and family links. Departed pupils retain their archived records. Teachers must be reassigned. Tests verify historical class and pupil preservation. |
| P1 | Submitted answers were displayed using current field labels; history lookup assumed every version increment created a history row. A renamed/reordered choice could change the apparent meaning of an old answer. | New responses and subsequent response revisions store their title/questions/options. UI and PDF use a common version projection. Old complete histories remain readable; missing historical labels are explicitly marked unavailable instead of guessed. Existing missing history cannot be reconstructed. |
| P2 | An already-open content editor could replace a newer entry revision; malformed dates could pass string ordering/regex checks. | Entry version comparison rejects stale editors. Real calendar-date/instant checks cover events, requests, form date answers and booking dates. Current-class checks reject authoring against archived/missing class IDs. |
| P2 | Persistence lacked direct tests; tests/configuration were not typechecked; unused-variable warnings did not fail verification. | Repository tests, coverage gates, test/config typechecking, strict unused-variable errors and Knip are now part of `npm run check` and CI. |
| P2 | The engine combined all administration and product workflows; several exports and a calendar adapter had no consumers. | Administration, command/audit primitives, date validation and form-history projection now have separate domain modules. The established engine imports remain compatible. Unused exports and the unused adapter were removed. Asset-generation scripts are explicitly registered rather than misclassified as dead code. |

These changes retain database name `peyrieu-school-demo-v1`, database version 1, state schema 1 and existing IDs. New snapshot/history properties are optional when reading legacy data. There is no automatic reset or destructive migration. Refresh older open app versions before comparing concurrent-tab behavior: an old application binary cannot enforce rules added by this release.

## Current data structure

There is **no server database**. IndexedDB has two object stores: `state['current']` holds a complete typed snapshot; `files[id]` holds bytes and MIME type (legacy raw Blobs are still readable). Local storage holds only the active demo persona and onboarding choice. `revision` is a concurrency token, `schema` describes the stored contract, and `seedVersion` identifies fixture upgrades; these are different concepts.

The snapshot separates adults, pupils, classes, publications, submissions, vote content/receipts, attachment metadata, bookings, notifications, review tasks, audit and drafts. That is a sensible domain inventory for this prototype. Immutable transitions preserve previous input state, central policies account for roles and relationships, and submitted forms retain answer history.

Remaining limitations are intentional and must not be carried into production unchanged:

- Every change clones, validates and writes the entire snapshot. Arrays are scanned repeatedly, audit/history grow without bounds, and there are no indexed queries or pagination. Revision rejection prevents overwrite but does not synchronize or merge tabs/devices.
- Family links appear on both adults and pupils. The validator detects inconsistency, but a production database should use one relationship table. Current staff/service memberships lack their own effective dates and full assignment history.
- The generic `Entry` contains fields for eight unrelated resource types. Its TypeScript shape permits combinations that should be impossible. Domain checks cover important rules, not every invalid combination.
- Health/support information and emergency/collection contacts are partly free text. Decide what needs structure, field-level disclosure, validation and effective dates before collecting it.
- Consent maps describe current decisions; an append-only, purpose/version/actor/time consent record is needed for a real service. The demo audit is locally mutable and is not a tamper-resistant audit service.
- Files uploaded for an editor that is subsequently abandoned remain staged in local storage until reset. Atomic saves prevent transaction orphans, but a production staging expiry/garbage-collection policy is still required. Browser eviction and user clearing can remove all local data; there is no recoverable backup.
- The organiser projection separates anonymous poll results from identity receipts, but the local dataset contains the linkage. It does not provide anonymity against a person inspecting the browser storage.

## Recommended production data model

Use a relational database with explicit migrations and private object storage for files. PostgreSQL is a reasonable design target; this is a proposal, not a provisioned database or a commitment to a hosting vendor. Keep IDs stable and migrate synthetic fixtures separately from real onboarding. Do not import the public demo's people or blobs as real records.

| Current concept | Proposed records and essential constraints |
| --- | --- |
| Adults and roles | `people`, `accounts`, `school_memberships`, `role_assignments`; verified identity separate from person details, account status and dated role scope. Derive the actor from the authenticated session. |
| Pupils and guardians | `pupils`, `guardian_pupil_links`; unique active link per pair, verification actor/time, relationship and access scope; no duplicate guardian arrays or shared household login. |
| Classes and teaching | `academic_years`, `classes`, `pupil_enrollments`, `staff_assignments`; class FK to year, dated assignments, history retained; transfers update enrollment rather than recreating the pupil. |
| Services and mandates | `service_enrollments`, `service_staff_assignments`, `representative_mandates`; explicit scope and independent validity windows. |
| Care and evidence | Versioned `care_reports`, `reviewed_care_instructions`, `evidence_reviews` and file grants; practical instructions and confidential evidence have different projections and permissions. |
| Publications/calendar | Shared resource identity plus separate `posts`, `evaluations`, `events`, audience relations and publication versions. Event instants use UTC with the relevant IANA timezone; all-day dates stay dates. |
| Messages | `conversations`, `conversation_participants`, `messages`, `message_files`, `read_states`; individual messages are queryable records, with explicit participants and service membership rules. |
| Forms | `forms`, immutable `form_versions`, recipient/response-unit relations, `submissions`, immutable `submission_versions`; one accepted response per form and designated child/adult unit, private drafts per actor, original title/questions/options/answers retained together. Versioned question schemas can be JSONB while their ownership and relationships remain relational. |
| Consents | Immutable `consent_decisions` keyed by pupil, guardian, purpose and policy/year version; current effective choice derived from those records. Withdrawal drives file access and review work. |
| Polls | `polls`, `poll_options`, separate eligibility receipts and answer storage; enforce response-unit uniqueness and expose only the intended organiser projection. Agree the actual anonymity promise before choosing identity-link retention. |
| Files/profile photos | `attachments`, resource/profile grants, private object keys, scan state, size/type/hash and lifecycle timestamps. Metadata commits with domain linkage; asynchronous object cleanup must be retryable. |
| Reservations | `booking_requests`, `booking_status_events`, provider references and idempotency keys; uniqueness for an active pupil/service/date/session booking, transactional capacity handling and authoritative provider confirmation. |
| Background work | Transactional `outbox`, notification jobs/delivery attempts, subscriptions and revocable feed tokens; retry, deduplicate and recheck access at delivery/read time. |
| Audit/drafts | Restricted audit events and actor-owned drafts with explicit retention. Avoid storing full medical content or anonymous identity mappings in routine logs. |

Use primary/foreign keys, uniqueness, non-null and check constraints, with transactions for related changes; application validation complements those constraints. Define delete/archive semantics before enabling cascades. See the [PostgreSQL constraint documentation](https://www.postgresql.org/docs/current/ddl-constraints.html).

```mermaid
erDiagram
    ACADEMIC_YEAR ||--o{ CLASS : contains
    PUPIL ||--o{ ENROLLMENT : retains
    CLASS ||--o{ ENROLLMENT : receives
    ADULT ||--o{ GUARDIAN_LINK : holds
    PUPIL ||--o{ GUARDIAN_LINK : has
    ADULT ||--o{ STAFF_ASSIGNMENT : holds
    CLASS ||--o{ STAFF_ASSIGNMENT : scopes
    FORM ||--|{ FORM_VERSION : versions
    FORM ||--o{ SUBMISSION : receives
    SUBMISSION ||--|{ SUBMISSION_VERSION : preserves
    FORM_VERSION ||--o{ SUBMISSION_VERSION : defines
```

## Production blockers and next engineering work

| Priority | Required work | Completion evidence |
| --- | --- | --- |
| P0 — before real data | Real authentication/session lifecycle, verified invitations/recovery, appropriate MFA, and server-side relationship-aware authorization for every read/write/export/file. Remove the persona selector and complete seed from production bundles. | API tests using real independent sessions: parent/teacher/service/representative boundaries, guessed IDs, cross-family reads, revoked roles, changed classes, confidential files and exports. A browser must never receive the full school snapshot. |
| P0 — before real data | Shared persistent database, private file storage, service secrets outside frontend code, backup/restore and controlled environments. | Tested migrations, transactional concurrent-write tests, backup restoration and private object-access tests. Synthetic staging data only. |
| P0 — before real data | School/operator decisions on collected fields, consent, access, retention/deletion, incident ownership and offline handling. | Approved operating model and a threat model covering children's and health information, device sharing, exports and revoked access. No legal-compliance conclusion is made by this review. |
| P1 — first production iteration | Small validated commands/DTOs and discriminated resource types. Move remaining inline UI mutations (notifications, correction requests, feed simulation, reminders and upload registration) into application services. Do not expose `change(fn)` or accept a whole client `State` as a server API. | Domain/application tests call the same services used by HTTP handlers; malformed/unknown fields and invalid status transitions are rejected. Server-created actor, time and audit metadata cannot be supplied by the client. |
| P1 — first production iteration | Authoritative query projections, pagination, resource versions and idempotency. Replace synchronous whole-state adapters with asynchronous request/result ports. | Concurrent parents submitting one shared form, concurrent booking capacity, duplicate retries, revocation during uploads and class transfers tested against the actual database. |
| P1 — first production iteration | Private uploads with size/type checks, scanning/quarantine, access grants and safe download headers; staged-object cleanup. | Rejected MIME/content mismatches, over-limit files, malware fixtures in an isolated test environment, revoked access and orphan cleanup. Browser signature sniffing alone is insufficient. [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). |
| P1 — before pilot operation | Background job delivery, structured redacted logs, error monitoring, availability checks, safe deployment rollback and tested restore procedures. | Delivery/retry/dead-letter tests, revocation at delivery time, an exercised restore and incident runbook. Current notification clock and provider confirmations remain simulations. |
| P2 — as features move to production | Split large UI feature files; separate browser export/DOM helpers from pure domain logic; simplify French-only UI literals without discarding stored legacy fields. Add loading/error boundaries and feature-level state/query management. | Feature modules have explicit dependencies and tests; production bundles contain no demo-only adapters or fixture assets. |
| P2 — before performance sign-off | Lazy-load routes and PDF generation; index/paginate server queries; measure realistic volume and slower phones/networks. | Measured route/load/export budgets and load tests. The current build still emits its large-chunk advisory; no scalability or mobile performance certification is claimed. |

Relationship-aware, deny-by-default server checks and authorization regression tests follow [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Use [OWASP ASVS](https://owasp.org/projects/asvs) to choose and track a production verification scope with the operator, rather than claiming blanket “industry-standard compliance.”

A practical first vertical slice is authenticated staff management of classes/pupils and verified guardian links backed by the new database. Keep the current UI and regression scenarios, add server policy tests, then move messaging/forms and files. Bring reservations and background delivery across only after the provider and operating contracts are defined.

## Verification and its limits

The baseline passed lint/build, 56 unit tests and 52 Chromium browser journeys. Core/data V8 coverage was 74.73% lines / 69.85% branches, with **0% direct repository coverage**. Browser journeys tested some storage indirectly.

The updated commands are:

```sh
npm ci
npm run check
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm audit
```

`npm run check` runs ESLint, Knip, application/test/configuration typechecking, unit/integration coverage gates and the production build. CI runs it before browser tests/deployment. No workflow permission was widened.

The coverage scope is all runtime code under `src/domain` and `src/data`, excluding fictional seed/template fixtures. UI, scripts and CSS are **not included in that percentage**; browser/Axe/layout checks exercise them separately. Coverage reports are generated locally under `coverage/` and are not shipped in the PWA. Gates are 80% statements/lines, 70% branches and 75% functions overall, plus 90% lines/80% branches for the repository and 80% lines/75% branches for policy. These are regression floors for this demo, not proof of production readiness.

Final measured results are recorded in [TESTING.md](TESTING.md). Repository tests use fake IndexedDB for deterministic corruption, concurrent transaction, quota-failure and rollback checks; actual Chromium, Firefox and WebKit tests cover stale tabs and recovery. Existing journeys continue to cover roles, known-ID denial, forms, files/photos, persistence, calendar/DST, bookings, offline/update behavior, responsive widths, keyboard interactions and automated accessibility checks.

Still needed for a real service: API/authentication integration tests, database migrations/restore/rollback, full authorization combinations, race/load tests with real transactions, background delivery/provider failure tests, manual assistive-technology and physical-device review, and an independent security assessment. Passing tests and a clean npm audit do not rule out undisclosed vulnerabilities or business-rule gaps.

The transaction implementation follows [IndexedDB transaction guidance](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB). Coverage is measured using the [Vitest V8 provider](https://vitest.dev/guide/coverage.html). Unused-code results come from [Knip](https://knip.dev/overview/getting-started), with entry points registered for the actual app, tests and maintenance scripts. Retained bilingual stored fields and old icon URLs have compatibility consumers and were not blindly deleted.

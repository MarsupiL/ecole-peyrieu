import { validDate, validInstant } from './validation';
export {
  setProfilePhoto,
  adminAdult,
  removeAdult,
  invite,
  createChild,
  editChild,
  moveChild,
  removeFromClass,
  archiveChild,
  restoreChild,
  setRepresentative,
  rollover,
  createClass,
  reviewEvidence,
  importChildren,
  auditView,
} from './administration';
import {
  uid,
  type State,
  type Adult,
  type Entry,
  type Answers,
  type Submission,
  type PhotoUse,
  type Choice,
  type Child,
  type Service,
  type Booking,
  tr,
  newEntry,
} from './types';
import {
  active,
  guardian,
  teaches,
  director,
  serves,
  represents,
  canRead,
  canManage,
  canAuthor,
  canContact,
  photoAllowed,
  eligible,
  responseChildren,
  guardianChildren,
  formDuty,
  canProcessForm,
} from './policy';
import { change, requireRule, RuleError } from './commands';
export { change, requireRule, RuleError } from './commands';
function inQuiet(s: State, a: Adult): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(new Date(s.clock));
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  if (
    a.roles.some((r) => ['teacher', 'director', 'service'].includes(r)) &&
    (weekday === 'Sat' || weekday === 'Sun' || h < a.availableStart || h >= a.availableEnd)
  )
    return true;
  return a.quietStart === a.quietEnd
    ? false
    : a.quietStart > a.quietEnd
      ? h >= a.quietStart || h < a.quietEnd
      : h >= a.quietStart && h < a.quietEnd;
}
export function notify(s: State, e: Entry, key: string, ids?: string[], excludeActor = e.author) {
  s.adults
    .filter(
      (a) =>
        active(s, a) &&
        a.id !== excludeActor &&
        canRead(s, a, e) &&
        (!ids || ids.includes(a.id)) &&
        a.notificationCategories.includes(e.kind),
    )
    .forEach((a) => {
      const k = `${key}:${a.id}`;
      if (!s.notices.some((n) => n.key === k))
        s.notices.push({
          id: uid(),
          actor: a.id,
          kind: e.kind,
          resourceId: e.id,
          at: s.clock,
          key: k,
          read: false,
          queued: inQuiet(s, a),
        });
    });
}
function get(s: State, a: Adult, id: string) {
  const e = s.entries.find((e) => e.id === id);
  requireRule(e && canRead(s, a, e));
  return e;
}
export function saveEntry(s: State, actor: string, input: Entry): State {
  return change(s, actor, 'save', input.id, (n, a) => {
    const old = n.entries.find((e) => e.id === input.id);
    requireRule(canAuthor(n, a, input.kind, input.audience, input.childId));
    requireRule(!old || canManage(n, a, old));
    requireRule(!old || old.version === input.version, 'staleEntry');
    requireRule(input.title.fr.trim() && input.body.fr.trim(), 'required');
    requireRule(!old || old.kind === input.kind, 'denied');
    if (input.kind === 'form') {
      requireRule(input.fields.length > 0, 'required');
      const ids = input.fields.map((f) => f.id);
      requireRule(
        new Set(ids).size === ids.length &&
          input.fields.every(
            (f) =>
              !!f.label.fr.trim() &&
              (!f.condition || (ids.includes(f.condition.field) && f.condition.field !== f.id)),
          ),
        'invalidFields',
      );
    }
    if (input.kind === 'event') {
      requireRule(
        input.start &&
          input.end &&
          (input.allDay
            ? validDate(input.start) && validDate(input.end)
            : validInstant(input.start) && validInstant(input.end)) &&
          Date.parse(input.end) > Date.parse(input.start),
        'invalidDate',
      );
      requireRule(Number.isInteger(input.capacity) && input.capacity >= 0, 'invalidCapacity');
    }
    if (input.deadline) requireRule(Number.isFinite(Date.parse(input.deadline)), 'invalidDate');
    if (input.kind === 'poll') {
      requireRule(input.options.length >= 2, 'required');
      if (old && n.voteReceipts.some((v) => v.pollId === old.id))
        requireRule(
          old.anonymous === input.anonymous &&
            old.unit === input.unit &&
            JSON.stringify(old.options) === JSON.stringify(input.options) &&
            JSON.stringify(old.audience) === JSON.stringify(input.audience),
          'pollLocked',
        );
    }
    if (input.photoFile && ['published', 'open'].includes(input.status))
      requireRule(
        input.photoUse &&
          input.photoUse === (input.audience.type === 'school' ? 'school' : 'class') &&
          photoAllowed(n, input.photoChildren, input.photoUse),
        'photoBlocked',
      );
    const e = structuredClone(input);
    e.author = old?.author ?? a.id;
    e.created = old?.created ?? n.clock;
    e.updated = n.clock;
    e.year = n.year;
    e.version = (old?.version ?? 0) + 1;
    e.sequence = (old?.sequence ?? -1) + 1;
    e.history = old
      ? [
          ...old.history,
          {
            at: old.updated,
            title: old.title,
            body: old.body,
            fields: old.fields,
            version: old.version,
          },
        ]
      : [];
    if (old) {
      e.reads = old.reads;
      e.acknowledgements = old.acknowledgements;
      e.messages = old.messages;
      e.volunteers = old.volunteers;
      e.rsvps = old.rsvps;
    }
    requireRule(
      e.responsible.every((id) =>
        n.adults.some(
          (p) =>
            p.id === id &&
            (e.kind === 'form'
              ? formDuty(n, p, e)
              : canAuthor(n, p, e.kind, e.audience, e.childId)),
        ),
      ),
      'denied',
    );
    if (old) n.entries[n.entries.findIndex((x) => x.id === e.id)] = e;
    else n.entries.push(e);
    if (['published', 'open', 'cancelled'].includes(e.status))
      notify(n, e, `publish:${e.id}:${e.version}`, undefined, a.id);
  });
}
export function setEntryStatus(
  s: State,
  actor: string,
  id: string,
  status: Entry['status'],
  note = '',
  deadline?: string,
) {
  return change(s, actor, status, id, (n, a) => {
    const e = get(n, a, id);
    requireRule(canManage(n, a, e));
    requireRule(
      ['closed', 'archived', 'open', 'cancelled', 'published', 'resolved'].includes(status),
    );
    if (status === 'published' && e.photoFile)
      requireRule(
        e.photoUse &&
          e.photoUse === (e.audience.type === 'school' ? 'school' : 'class') &&
          photoAllowed(n, e.photoChildren, e.photoUse),
        'photoBlocked',
      );
    if (status === 'open' && (deadline || (e.deadline && e.deadline < n.clock))) {
      requireRule(note.trim() && deadline && deadline > n.clock, 'reopenReason');
      e.deadline = deadline;
    }
    e.status = status;
    e.updated = n.clock;
    e.version++;
    e.sequence++;
    e.reviewNote = note;
    notify(n, e, `status:${id}:${e.version}`, undefined, a.id);
  });
}
export function validateAnswers(e: Entry, answers: Answers): string[] {
  return e.fields
    .filter((f) => !f.condition || answers[f.condition.field] === f.condition.value)
    .filter((f) => {
      const v = answers[f.id];
      if (
        f.required &&
        (!v || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim()))
      )
        return true;
      if (!v) return false;
      if (f.type === 'consent') return !['allowed', 'refused'].includes(String(v));
      if (f.type === 'date') return typeof v !== 'string' || !validDate(v);
      if (f.type === 'select') return !f.options?.[Number(v)];
      if (f.type === 'multi') return !Array.isArray(v) || v.some((x) => !f.options?.[Number(x)]);
      return false;
    })
    .map((f) => f.id);
}
export function submitForm(
  s: State,
  actor: string,
  id: string,
  childId: string,
  answers: Answers,
  draft: boolean,
  confirmed: boolean,
) {
  return change(s, actor, draft ? 'draft' : 'submit', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(e.kind === 'form' && a.roles.includes('guardian'));
    const c = n.children.find((c) => c.id === childId);
    requireRule(c && responseChildren(n, a, e).some((x) => x.id === childId));
    requireRule(
      !['closed', 'archived', 'draft'].includes(e.status) && (!e.deadline || e.deadline >= n.clock),
      'deadline',
    );
    const matches = (x: Submission) =>
      x.formId === id && (e.unit === 'adult' ? x.adultId === a.id : x.childId === childId);
    const submitted = n.submissions.find((x) => matches(x) && !x.draft);
    const x = submitted ?? n.submissions.find((x) => matches(x) && x.draft && x.author === a.id);
    requireRule(!submitted || submitted.author === a.id, 'owner');
    requireRule(!submitted || !draft, 'useRevision');
    if (!draft) {
      requireRule(confirmed, 'confirmRequired');
      requireRule(!validateAnswers(e, answers).length, 'required');
    }
    for (const f of e.fields.filter((f) => f.type === 'file' && answers[f.id]))
      requireRule(
        n.attachments.some(
          (file) => file.id === answers[f.id] && file.owner === a.id && file.entryId === e.id,
        ),
        'invalidFile',
      );
    const clean: Answers = {};
    e.fields
      .filter((f) => !f.condition || answers[f.condition.field] === f.condition.value)
      .forEach((f) => {
        if (answers[f.id] !== undefined) clean[f.id] = structuredClone(answers[f.id]);
      });
    const submission: Submission = {
      id: x?.id ?? uid(),
      formId: id,
      childId,
      adultId: e.unit === 'adult' ? a.id : undefined,
      author: a.id,
      draft,
      answers: clean,
      at: n.clock,
      formVersion: e.version,
      formSnapshot: structuredClone({ title: e.title, fields: e.fields }),
      history:
        x && !x.draft
          ? [
              ...x.history,
              {
                answers: x.answers,
                at: x.at,
                version: x.formVersion,
                formSnapshot: x.formSnapshot,
              },
            ]
          : (x?.history ?? []),
      status: draft ? 'draft' : 'submitted',
      snapshot: {
        child: c.name,
        contact: e.unit === 'adult' ? a.contact : '',
        emergency: c.emergency,
      },
      confirmation: confirmed,
    };
    if (x) n.submissions[n.submissions.indexOf(x)] = submission;
    else n.submissions.push(submission);
    if (!draft)
      notify(n, e, `submit:${submission.id}:${submission.history.length}`, e.responsible, a.id);
  });
}
export function reviewSubmission(
  s: State,
  actor: string,
  id: string,
  status: Submission['status'],
  note: string,
) {
  return change(s, actor, 'review', id, (n, a) => {
    const x = n.submissions.find((x) => x.id === id);
    requireRule(x);
    const e = get(n, a, x.formId);
    requireRule(
      !x.draft &&
        e.year === n.year &&
        e.status !== 'archived' &&
        canProcessForm(n, a, e, x.childId),
    );
    requireRule(['reviewed', 'completed', 'needsCorrection'].includes(status));
    if (status === 'needsCorrection') requireRule(note.trim(), 'required');
    x.status = status;
    x.note = note;
    notify(n, e, `review:${id}:${n.revision}`, [x.author], a.id);
  });
}
export function flag(s: State, actor: string, entryId: string, childId: string, note: string) {
  return change(s, actor, 'flag', entryId, (n, a) => {
    const e = get(n, a, entryId);
    requireRule(note.trim(), 'required');
    requireRule(!childId || n.children.some((c) => c.id === childId && guardian(n, a, c)));
    n.tasks.push({
      id: uid(),
      entryId,
      childId: childId || undefined,
      type: 'correction',
      author: a.id,
      staff: e.responsible,
      at: n.clock,
      status: 'pending',
      note,
    });
    notify(n, e, `flag:${n.revision}`, e.responsible, a.id);
  });
}
export function setConsent(
  s: State,
  actor: string,
  childId: string,
  use: PhotoUse,
  choice: Choice,
) {
  return change(s, actor, 'consent', childId, (n, a) => {
    const c = n.children.find((c) => c.id === childId);
    requireRule(c && guardian(n, a, c));
    c.consents[use][a.id] = choice;
    c.consentVersion++;
    if (choice !== 'allowed') {
      n.entries
        .filter((e) => e.photoChildren.includes(childId) && e.photoUse === use)
        .forEach((e) => {
          n.tasks.push({
            id: uid(),
            childId,
            entryId: e.id,
            type: 'photo',
            author: a.id,
            staff: e.responsible,
            at: n.clock,
            status: 'pending',
            note: 'consent',
          });
          notify(n, e, `withdrawal:${childId}:${c.consentVersion}`, e.responsible, a.id);
        });
      if (
        !n.tasks.some((t) => t.childId === childId && t.type === 'photo' && t.status === 'pending')
      )
        n.tasks.push({
          id: uid(),
          childId,
          type: 'photo',
          author: a.id,
          staff: n.adults.filter((p) => teaches(n, p, c) || director(n, p)).map((p) => p.id),
          at: n.clock,
          status: 'pending',
          note: use,
        });
    }
  });
}
export function updateProfile(
  s: State,
  actor: string,
  childId: string,
  patch: Pick<Child, 'care' | 'diet' | 'familyDiet' | 'support' | 'emergency' | 'collectors'>,
) {
  return change(s, actor, 'profile', childId, (n, a) => {
    const c = n.children.find((c) => c.id === childId);
    requireRule(c && guardian(n, a, c));
    requireRule(
      Object.keys(patch).every((key) =>
        ['care', 'diet', 'familyDiet', 'support', 'emergency', 'collectors'].includes(key),
      ),
    );
    Object.assign(c, structuredClone(patch));
    c.careStatus = 'reported';
    const staff = n.adults
      .filter((p) => teaches(n, p, c) || director(n, p) || serves(n, p, c))
      .map((p) => p.id);
    n.tasks.push({
      id: uid(),
      childId,
      type: 'care',
      author: a.id,
      staff,
      at: n.clock,
      status: 'pending',
      note: 'profile',
    });
  });
}
export function reviewTask(s: State, actor: string, id: string) {
  return change(s, actor, 'reviewTask', id, (n, a) => {
    const t = n.tasks.find((t) => t.id === id);
    requireRule(t && t.staff.includes(a.id));
    const c = n.children.find((c) => c.id === t.childId);
    requireRule(!c || teaches(n, a, c) || director(n, a) || serves(n, a, c));
    t.status = 'completed';
    if (c && t.type === 'care') {
      c.reviewedCare = structuredClone(c.care);
      c.careStatus = 'reviewed';
    }
  });
}
export function createConversation(
  s: State,
  actor: string,
  title: string,
  text: string,
  participants: string[],
  team?: Service,
  link?: string,
) {
  return change(s, actor, 'conversation', link ?? '', (n, a) => {
    requireRule(title.trim() && text.trim(), 'required');
    if (team)
      requireRule(
        guardianChildren(n, a).some((c) => c.services.includes(team)) ||
          (a.roles.includes('service') && a.services.includes(team)),
      );
    requireRule(
      participants.every((id) => {
        const b = n.adults.find((x) => x.id === id);
        const sharedGuardian =
          b && active(n, b) && guardianChildren(n, a).some((c) => guardian(n, b, c));
        const hasStaff =
          team ||
          participants.some((id) => n.adults.some((p) => p.id === id && canContact(n, a, p)));
        return (
          b &&
          (canContact(n, a, b) ||
            (sharedGuardian && hasStaff) ||
            (!!link &&
              n.entries.some((e) => e.id === link && canRead(n, a, e) && e.author === b.id)))
        );
      }),
    );
    requireRule(team || participants.length, 'required');
    if (link) requireRule(n.entries.some((e) => e.id === link && canRead(n, a, e)));
    const e = newEntry('conversation', a.id, n.year, n.clock);
    Object.assign(e, {
      title: tr(title, title),
      body: tr(text, text),
      participants: [...new Set([a.id, ...participants])],
      team,
      link,
      status: 'open',
      messages: [{ id: uid(), author: a.id, text, at: n.clock, files: [] }],
    });
    n.entries.push(e);
    delete n.drafts[`${a.id}:compose:${link ?? 'new'}`];
    notify(n, e, `message:${e.id}`);
  });
}
export function message(s: State, actor: string, id: string, text: string, files: string[] = []) {
  return change(s, actor, 'message', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(
      ['conversation', 'topic'].includes(e.kind) &&
        ['open', 'published'].includes(e.status) &&
        e.year === n.year,
    );
    requireRule(text.trim() || files.length, 'required');
    requireRule(
      files.every((id) =>
        n.attachments.some((f) => f.id === id && f.owner === a.id && f.entryId === e.id),
      ),
      'invalidFile',
    );
    e.messages.push({ id: uid(), author: a.id, text, at: n.clock, files });
    e.reads[a.id] = n.clock;
    e.updated = n.clock;
    delete n.drafts[`${a.id}:${id}`];
    notify(n, e, `message:${e.messages.at(-1)!.id}`, undefined, a.id);
  });
}
export function assign(s: State, actor: string, id: string, handler: string) {
  return change(s, actor, 'assign', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(e.team && a.roles.includes('service') && a.services.includes(e.team));
    requireRule(
      !handler ||
        n.adults.some(
          (p) =>
            p.id === handler &&
            active(n, p) &&
            p.roles.includes('service') &&
            p.services.includes(e.team!),
        ),
    );
    e.handler = handler;
  });
}
export function markRead(s: State, actor: string, id: string, ack = false) {
  return change(s, actor, ack ? 'acknowledge' : 'opened', id, (n, a) => {
    const e = get(n, a, id);
    e.reads[a.id] = n.clock;
    if (ack) {
      requireRule(
        e.kind === 'evaluation' &&
          e.status === 'published' &&
          e.requireAck &&
          n.children.some((c) => c.id === e.childId && guardian(n, a, c)),
      );
      e.acknowledgements[a.id] = n.clock;
      notify(n, e, `ack:${e.id}:${a.id}`, e.responsible, a.id);
    }
    n.notices
      .filter((v) => v.actor === a.id && v.resourceId === id)
      .forEach((v) => (v.read = true));
  });
}
export function moderate(s: State, actor: string, id: string, messageId: string, reason: string) {
  return change(s, actor, 'moderation', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(e.kind === 'topic' && e.audience.ids.some((c) => represents(n, a, c)));
    requireRule(reason.trim(), 'required');
    const m = e.messages.find((m) => m.id === messageId);
    requireRule(m);
    m.removed = true;
    m.reason = reason;
  });
}
export function reportMessage(
  s: State,
  actor: string,
  id: string,
  messageId: string,
  note: string,
) {
  return change(s, actor, 'report', id, (n, a) => {
    const e = get(n, a, id);
    const m = e.messages.find((m) => m.id === messageId);
    requireRule(m && note.trim(), 'required');
    n.tasks.push({
      id: uid(),
      entryId: id,
      type: 'report',
      author: a.id,
      staff: n.adults
        .filter((p) => e.audience.ids.some((c) => represents(n, p, c)))
        .map((p) => p.id),
      at: n.clock,
      status: 'pending',
      note: `${note}\n${m.text}`,
    });
  });
}
export function evaluateReview(
  s: State,
  actor: string,
  id: string,
  review: Entry['review'],
  note: string,
) {
  return change(s, actor, 'evaluationReview', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(e.kind === 'evaluation');
    if (review === 'requested') {
      requireRule(e.author === a.id);
      const d = n.adults.find((p) => director(n, p));
      if (d && !e.responsible.includes(d.id)) e.responsible.push(d.id);
    } else requireRule(director(n, a) && e.responsible.includes(a.id));
    e.review = review;
    e.reviewNote = note;
    notify(n, e, `review-request:${n.revision}`, e.responsible, a.id);
  });
}
export function answerPoll(
  s: State,
  actor: string,
  id: string,
  childId: string,
  answers: string[],
  comment: string,
) {
  return change(s, actor, 'pollResponse', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(
      e.kind === 'poll' && e.status === 'open' && (!e.deadline || e.deadline >= n.clock),
      'deadline',
    );
    requireRule(eligible(n, e).some((p) => p.id === a.id));
    requireRule(
      answers.length > 0 &&
        answers.every(
          (v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < e.options.length,
        ) &&
        new Set(answers).size === answers.length &&
        (e.pollType === 'multi' || answers.length === 1),
      'required',
    );
    const unitId = e.unit === 'adult' ? a.id : childId;
    requireRule(e.unit === 'adult' || responseChildren(n, a, e).some((c) => c.id === childId));
    const receipt = n.voteReceipts.find((r) => r.pollId === id && r.unitId === unitId);
    requireRule(!receipt || receipt.owner === a.id, 'owner');
    if (receipt) {
      const v = n.votes.find((v) => v.id === receipt.capability);
      requireRule(v);
      v.answers = answers;
      v.comment = comment;
    } else {
      const capability = uid();
      n.voteReceipts.push({ pollId: id, unitId, owner: a.id, capability });
      n.votes.push({ id: capability, pollId: id, answers, comment });
    }
    // Audit deliberately records no respondent-to-answer mapping for anonymous polls.
  });
}
export function pollResults(s: State, a: Adult, id: string) {
  const e = s.entries.find((e) => e.id === id);
  requireRule(e && canManage(s, a, e));
  return s.votes
    .filter((v) => v.pollId === id)
    .map((v) => ({
      answers: v.answers,
      comment: v.comment,
      ...(e.anonymous
        ? {}
        : { respondent: s.voteReceipts.find((r) => r.capability === v.id)?.unitId }),
    }));
}
export function ownVote(s: State, a: Adult, e: Entry, childId: string) {
  requireRule(canRead(s, a, e));
  const unitId = e.unit === 'adult' ? a.id : childId;
  if (e.unit === 'child') requireRule(responseChildren(s, a, e).some((c) => c.id === childId));
  const r = s.voteReceipts.find((r) => r.pollId === e.id && r.unitId === unitId);
  return r ? { vote: s.votes.find((v) => v.id === r.capability), owner: r.owner } : undefined;
}
export function publishSummary(s: State, actor: string, id: string, summary: string) {
  return change(s, actor, 'summary', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(e.kind === 'poll' && canManage(n, a, e));
    requireRule(summary.trim(), 'required');
    e.summary = summary;
    notify(n, e, `summary:${n.revision}`, undefined, a.id);
  });
}
export function createRequest(s: State, actor: string, input: Entry) {
  return change(s, actor, 'request', input.childId ?? '', (n, a) => {
    const c = n.children.find((c) => c.id === input.childId);
    requireRule(c && guardian(n, a, c));
    requireRule(
      input.teams.length &&
        input.teams.every((v) => v === 'school' || c.services.includes(v as Service)),
      'required',
    );
    requireRule(
      input.start &&
        input.end &&
        (validDate(input.start) || validInstant(input.start)) &&
        (validDate(input.end) || validInstant(input.end)) &&
        Date.parse(input.end) >= Date.parse(input.start),
      'invalidDate',
    );
    requireRule(input.requestType === 'absence' || input.requestType === 'collection');
    if (input.requestType === 'collection') requireRule(input.requestDetails?.trim(), 'required');
    const e = {
      ...input,
      id: uid(),
      author: a.id,
      kind: 'request' as const,
      year: n.year,
      status: 'pending' as const,
      created: n.clock,
      updated: n.clock,
      teamAcks: {},
    };
    n.entries.push(e);
    notify(n, e, `request:${e.id}`);
  });
}
export function handleRequest(
  s: State,
  actor: string,
  id: string,
  team: string,
  status: 'confirmed' | 'declined' | 'cancelled' | 'completed' | 'pending',
) {
  return change(s, actor, 'requestStatus', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(e.kind === 'request' && e.year === n.year);
    if (a.id === e.author) {
      requireRule(status === 'cancelled' || status === 'pending');
      e.status = status;
      if (status === 'pending') e.teamAcks = {};
      return;
    }
    const c = n.children.find((c) => c.id === e.childId);
    requireRule(
      c &&
        e.teams.includes(team) &&
        (team === 'school'
          ? teaches(n, a, c) || director(n, a)
          : a.roles.includes('service') && a.services.includes(team as Service)),
    );
    if (e.requestType === 'absence') {
      e.teamAcks[team] = { actor: a.id, at: n.clock };
      if (e.teams.every((t) => e.teamAcks[t])) e.status = 'completed';
    } else {
      e.teamAcks[team] = { actor: a.id, at: n.clock };
      e.status = status;
    }
    notify(n, e, `request-status:${n.revision}`, [e.author], a.id);
  });
}
export function rsvp(s: State, actor: string, id: string, childId: string, value: string) {
  return change(s, actor, 'rsvp', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(
      e.kind === 'event' &&
        e.status === 'published' &&
        responseChildren(n, a, e).some((c) => c.id === childId),
    );
    requireRule(['yes', 'no', 'maybe'].includes(value));
    e.rsvps[childId] = value;
  });
}
export function volunteer(s: State, actor: string, id: string) {
  return change(s, actor, 'volunteer', id, (n, a) => {
    const e = get(n, a, id);
    requireRule(
      e.kind === 'event' && e.status === 'published' && eligible(n, e).some((p) => p.id === a.id),
    );
    if (e.volunteers.includes(a.id)) e.volunteers = e.volunteers.filter((id) => id !== a.id);
    else {
      requireRule(e.volunteers.length < e.capacity, 'full');
      e.volunteers.push(a.id);
    }
  });
}
export function bookingAvailability(
  s: State,
  childId: string,
  service: Service,
  date: string,
): 'available' | 'full' | 'deadline' {
  if (!validDate(date) || Date.parse(`${date}T06:00:00Z`) - Date.parse(s.clock) < 86400000)
    return 'deadline';
  return (new Date(`${date}T12:00:00Z`).getUTCDay() === 3 && service === 'canteen') ||
    s.bookings.filter(
      (b) =>
        b.service === service &&
        b.date === date &&
        b.childId !== childId &&
        b.status !== 'cancelled',
    ).length >= 12
    ? 'full'
    : 'available';
}
export function reserve(
  s: State,
  actor: string,
  childId: string,
  service: Service,
  dates: string[],
  session: string,
) {
  return change(s, actor, 'reserve', childId, (n, a) => {
    const c = n.children.find((c) => c.id === childId);
    requireRule(c && guardian(n, a, c) && c.services.includes(service));
    requireRule(
      dates.length > 0 && dates.length <= 31 && new Set(dates).size === dates.length,
      'required',
    );
    dates.forEach((date) => {
      requireRule(
        bookingAvailability(n, childId, service, date) === 'available',
        bookingAvailability(n, childId, service, date),
      );
      requireRule(
        !n.bookings.some(
          (b) =>
            b.childId === childId &&
            b.service === service &&
            b.date === date &&
            b.session === session &&
            b.status !== 'cancelled',
        ),
        'duplicate',
      );
    });
    dates.forEach((date) =>
      n.bookings.push({
        id: uid(),
        childId,
        service,
        date,
        session,
        status: 'requested',
        author: a.id,
        at: n.clock,
        history: [],
      }),
    );
  });
}
export function bookingStatus(s: State, actor: string, id: string, status: Booking['status']) {
  return change(s, actor, 'bookingStatus', id, (n, a) => {
    const b = n.bookings.find((b) => b.id === id);
    const c = n.children.find((c) => c.id === b?.childId);
    requireRule(
      b && c && (guardian(n, a, c) || (serves(n, a, c) && a.services.includes(b.service))),
    );
    if (status === 'cancellationRequested')
      requireRule(
        b.status === 'confirmed' &&
          Date.parse(`${b.date}T06:00:00Z`) - Date.parse(n.clock) >= 86400000,
        'deadline',
      );
    else if (status === 'confirmed') requireRule(b.status === 'requested');
    else if (status === 'cancelled')
      requireRule(b.status === 'cancellationRequested' || b.status === 'requested');
    else throw new RuleError('denied');
    b.history.push(`${b.status} · ${n.clock}`);
    b.status = status;
  });
}
export function advanceClock(s: State, actor: string, hours: number) {
  return change(s, actor, 'clock', 'demo', (n) => {
    requireRule(hours >= 0 && hours <= 8760, 'invalidDate');
    n.clock = new Date(Date.parse(n.clock) + hours * 3600000).toISOString();
    n.notices.forEach((v) => {
      const a = n.adults.find((a) => a.id === v.actor);
      if (a && !inQuiet(n, a)) v.queued = false;
    });
    n.entries.forEach((e) => {
      if (e.status === 'scheduled' && e.scheduled && e.scheduled <= n.clock) {
        if (
          e.photoFile &&
          (!e.photoUse ||
            e.photoUse !== (e.audience.type === 'school' ? 'school' : 'class') ||
            !photoAllowed(n, e.photoChildren, e.photoUse))
        ) {
          e.status = 'draft';
          e.reviewNote = 'Photo : accord à revérifier';
          notify(n, e, `photo-schedule-blocked:${e.id}`, [e.author, ...e.responsible], 'system');
          return;
        }
        e.status = e.kind === 'poll' ? 'open' : 'published';
        notify(n, e, `schedule:${e.id}`);
      }
      if (
        e.status === 'closed' ||
        e.status === 'cancelled' ||
        e.status === 'archived' ||
        e.status === 'draft'
      )
        return;
      eligible(n, e).forEach((a) => {
        if (e.kind === 'event' && a.eventReminder && e.start) {
          const delta = Date.parse(e.start) - Date.parse(n.clock);
          if (delta > 0 && delta <= a.eventReminder * 3600000)
            notify(n, e, `event-reminder:${e.id}:${e.sequence}`, [a.id]);
        }
        if (['form', 'poll'].includes(e.kind) && e.deadline && a.taskReminders) {
          const remaining = Date.parse(e.deadline) - Date.parse(n.clock);
          const units = e.unit === 'adult' ? [a.id] : responseChildren(n, a, e).map((c) => c.id);
          const outstanding = units.some((unit) =>
            e.kind === 'form'
              ? !n.submissions.some(
                  (x) =>
                    x.formId === e.id &&
                    !x.draft &&
                    (e.unit === 'adult' ? x.adultId === unit : x.childId === unit),
                )
              : !n.voteReceipts.some((v) => v.pollId === e.id && v.unitId === unit),
          );
          const d = remaining <= 86400000 ? 1 : 3;
          if (outstanding && remaining > 0 && remaining <= d * 86400000)
            notify(n, e, `task-reminder:${e.id}:${e.deadline}:${d}`, [a.id]);
        }
      });
    });
  });
}
export function setPreferences(
  s: State,
  actor: string,
  patch: Partial<
    Pick<
      Adult,
      | 'locale'
      | 'quietStart'
      | 'quietEnd'
      | 'eventReminder'
      | 'taskReminders'
      | 'availableStart'
      | 'availableEnd'
      | 'notificationCategories'
      | 'contact'
    >
  >,
) {
  return change(s, actor, 'preferences', 'self', (n, a) => {
    const allowed = [
      'locale',
      'quietStart',
      'quietEnd',
      'eventReminder',
      'taskReminders',
      'availableStart',
      'availableEnd',
      'notificationCategories',
      'contact',
    ];
    requireRule(Object.keys(patch).every((key) => allowed.includes(key)));
    const next = { ...a, ...patch };
    const hour = (v: number, max = 23) => Number.isInteger(v) && v >= 0 && v <= max;
    requireRule(
      ['fr', 'en'].includes(next.locale) &&
        typeof next.contact === 'string' &&
        next.contact.length <= 250 &&
        hour(next.quietStart) &&
        hour(next.quietEnd) &&
        hour(next.availableStart) &&
        hour(next.availableEnd, 24) &&
        Number.isInteger(next.eventReminder) &&
        next.eventReminder >= 0 &&
        next.eventReminder <= 168 &&
        typeof next.taskReminders === 'boolean' &&
        Array.isArray(next.notificationCategories) &&
        next.notificationCategories.every((k) =>
          [
            'post',
            'form',
            'evaluation',
            'poll',
            'event',
            'topic',
            'conversation',
            'request',
          ].includes(k),
        ),
      'invalidPreferences',
    );
    Object.assign(a, structuredClone(patch));
  });
}
export function saveDraft(s: State, actor: string, key: string, text: string) {
  return change(s, actor, 'draft', 'local', (n, a) => {
    n.drafts[`${a.id}:${key}`] = text;
  });
}
export function feedback(s: State, actor: string, area: string, text: string) {
  return change(s, actor, 'feedback', 'local', (n, a) => {
    requireRule(text.trim(), 'required');
    n.feedback.push({ id: uid(), actor: a.id, at: n.clock, area, text });
  });
}

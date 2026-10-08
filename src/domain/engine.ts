import {
  uid,
  type ProfileTarget,
  type Attachment,
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
  canManageProfilePhoto,
  profileRecord,
  staffPhotoEligible,
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
  currentChild,
  currentClass,
  canManageClass,
} from './policy';
export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function requireRule(ok: unknown, code = 'denied'): asserts ok {
  if (!ok) throw new RuleError(code);
}
export function change(
  s: State,
  actor: string,
  action: string,
  resource: string,
  fn: (next: State, a: Adult) => void,
): State {
  const next = structuredClone(s);
  const a = next.adults.find((a) => a.id === actor);
  if (!a || !active(next, a)) throw new RuleError('denied');
  fn(next, a);
  next.revision++;
  const auditActor =
    action === 'pollResponse' && next.entries.some((e) => e.id === resource && e.anonymous)
      ? 'anonymous'
      : actor;
  next.audit.push({ id: uid(), actor: auditActor, action, resource, at: next.clock });
  return next;
}
export function inQuiet(s: State, a: Adult): boolean {
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
      requireRule(input.start && input.end && input.end > input.start, 'invalidDate');
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
      ? [...old.history, { at: old.updated, title: old.title, body: old.body, fields: old.fields }]
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
      if (f.type === 'date') return !/^\d{4}-\d{2}-\d{2}$/.test(String(v));
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
      history:
        x && !x.draft
          ? [...x.history, { answers: x.answers, at: x.at, version: x.formVersion }]
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
    requireRule(canProcessForm(n, a, e, x.childId));
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
    Object.assign(c, patch);
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
        e.status !== 'closed' &&
        e.status !== 'resolved' &&
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
    requireRule(input.start && input.end && input.end >= input.start, 'invalidDate');
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
    requireRule(e.kind === 'request');
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
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Date.parse(`${date}T06:00:00Z`) - Date.parse(s.clock) < 86400000
  )
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
          e.reviewNote = 'Photo : accord à revérifier / Photo: permission must be reviewed';
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
const membershipRoles = ['guardian', 'teacher', 'director', 'service', 'representative'] as const;
const membershipStatuses = ['invited', 'active', 'suspended', 'expired', 'revoked'] as const;
const serviceIds = ['canteen', 'care', 'transport'] as const;
const photoUses: PhotoUse[] = ['class', 'school', 'print', 'website', 'social'];
const unique = <T>(values: T[]) => [...new Set(values)];
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const schoolEnd = (s: State) => `${Number(s.year.slice(0, 4)) + 1}-08-31`;
function validateMandate(s: State, end: string) {
  requireRule(
    validDate(end) && end >= s.clock.slice(0, 10) && end <= schoolEnd(s),
    'invalidMandate',
  );
}
function pruneMandates(s: State) {
  for (const p of s.adults) {
    p.representativeClasses = p.representativeClasses.filter(
      (id) =>
        p.roles.includes('guardian') &&
        currentClass(s, id) &&
        s.children.some(
          (c) =>
            currentChild(s, c) &&
            c.classId === id &&
            p.children.includes(c.id) &&
            c.guardians.includes(p.id),
        ),
    );
    if (!p.representativeClasses.length) p.roles = p.roles.filter((r) => r !== 'representative');
    if (p.mandateEnds)
      p.mandateEnds = Object.fromEntries(
        Object.entries(p.mandateEnds).filter(([id]) => p.representativeClasses.includes(id)),
      );
  }
}
function setGuardianLinks(s: State, p: Adult, ids: string[]) {
  for (const c of s.children) {
    const wasLinked = c.guardians.includes(p.id);
    const linked = p.roles.includes('guardian') && ids.includes(c.id);
    c.guardians = c.guardians.filter((id) => id !== p.id);
    if (linked) c.guardians.push(p.id);
    if (linked && !wasLinked)
      photoUses.forEach((use) => {
        c.consents[use][p.id] = 'awaiting';
      });
    if (wasLinked !== linked) c.consentVersion++;
  }
  p.children = p.roles.includes('guardian') ? unique(ids) : [];
}
export function setProfilePhoto(
  s: State,
  actor: string,
  target: ProfileTarget,
  file: Pick<Attachment, 'id' | 'name' | 'type' | 'size'> | null,
) {
  return change(s, actor, 'profilePhoto', target.id, (n, a) => {
    requireRule(canManageProfilePhoto(n, a, target));
    const record = profileRecord(n, target)!;
    if (file) {
      requireRule(
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
        'profilePhotoType',
      );
      requireRule(file.size > 0 && file.size <= 5 * 1024 * 1024, 'profilePhotoSize');
      requireRule(file.id && !n.attachments.some((f) => f.id === file.id), 'invalidFile');
    }
    if (record.photoId) n.attachments = n.attachments.filter((f) => f.id !== record.photoId);
    if (file) {
      n.attachments.push({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        profile: { ...target },
        owner: actor,
        at: n.clock,
        restricted: false,
      });
      record.photoId = file.id;
    } else delete record.photoId;
  });
}
export function adminAdult(
  s: State,
  actor: string,
  id: string,
  patch: Partial<
    Pick<
      Adult,
      | 'name'
      | 'contact'
      | 'status'
      | 'classes'
      | 'children'
      | 'services'
      | 'representativeClasses'
      | 'reviewers'
      | 'mandateEnd'
      | 'roles'
      | 'removalReason'
    >
  >,
) {
  return change(s, actor, 'membership', id, (n, a) => {
    requireRule(director(n, a));
    const target = n.adults.find((x) => x.id === id);
    requireRule(target && target.id !== a.id, 'protectedAccount');
    const keys = [
      'name',
      'contact',
      'status',
      'classes',
      'children',
      'services',
      'representativeClasses',
      'reviewers',
      'mandateEnd',
      'roles',
      'removalReason',
    ];
    requireRule(Object.keys(patch).every((key) => keys.includes(key)));
    const next = { ...target, ...patch };
    requireRule(
      next.name.trim() && next.name.length <= 160 && next.contact.length <= 250,
      'required',
    );
    requireRule(
      next.roles.length &&
        next.roles.every((r) => membershipRoles.includes(r)) &&
        membershipStatuses.includes(next.status),
      'invalidMembership',
    );
    next.roles = unique(next.roles);
    if (!next.roles.includes('guardian')) {
      next.children = [];
      next.representativeClasses = [];
      next.roles = next.roles.filter((r) => r !== 'representative');
    }
    requireRule(next.roles.length, 'invalidMembership');
    if (!next.roles.includes('teacher')) next.classes = [];
    if (!next.roles.includes('service')) next.services = [];
    requireRule(
      next.children.every((id) => n.children.some((c) => c.id === id)) &&
        next.reviewers.every((id) => n.children.some((c) => c.id === id)) &&
        next.classes.every((id) => currentClass(n, id)) &&
        next.services.every((v) => serviceIds.includes(v)),
      'invalidMembership',
    );
    requireRule(
      !next.reviewers.length ||
        next.roles.some((r) => ['director', 'teacher', 'service'].includes(r)),
      'invalidMembership',
    );
    requireRule(
      next.representativeClasses.every(
        (id) =>
          currentClass(n, id) &&
          next.roles.includes('guardian') &&
          n.children.some(
            (c) => currentChild(n, c) && c.classId === id && next.children.includes(c.id),
          ),
      ),
      'invalidRepresentative',
    );
    const newMandates = next.representativeClasses.filter(
      (id) => !target.representativeClasses.includes(id),
    );
    if (
      newMandates.length ||
      (patch.mandateEnd !== undefined && next.representativeClasses.length)
    ) {
      validateMandate(n, next.mandateEnd);
      const affected = patch.mandateEnd !== undefined ? next.representativeClasses : newMandates;
      next.mandateEnds = {
        ...next.mandateEnds,
        ...Object.fromEntries(affected.map((id) => [id, next.mandateEnd])),
      };
    }
    next.roles = next.representativeClasses.length
      ? unique([...next.roles, 'representative'])
      : next.roles.filter((r) => r !== 'representative');
    requireRule(
      n.adults.some((p) => p.id !== id && director(n, p)) ||
        (next.status === 'active' && next.roles.includes('director')),
      'protectedAccount',
    );
    Object.assign(target, next, {
      name: next.name.trim(),
      contact: next.contact.trim(),
      verifiedBy: a.id,
    });
    if (!staffPhotoEligible(target) && target.photoId) {
      n.attachments = n.attachments.filter((f) => f.id !== target.photoId);
      delete target.photoId;
    }
    setGuardianLinks(n, target, next.children);
    if (target.status === 'revoked') target.removedAt = n.clock;
    else {
      delete target.removedAt;
      delete target.removalReason;
    }
    pruneMandates(n);
  });
}
export function removeAdult(s: State, actor: string, id: string, reason: string) {
  requireRule(reason.trim(), 'required');
  return adminAdult(s, actor, id, { status: 'revoked', removalReason: reason.trim() });
}
export function invite(
  s: State,
  actor: string,
  name: string,
  role: Adult['roles'][number],
  childId: string,
  classId: string,
  options: { contact?: string; services?: Service[] } = {},
) {
  return change(s, actor, 'invite', 'adult', (n, a) => {
    requireRule(director(n, a));
    requireRule(name.trim() && name.length <= 160, 'required');
    requireRule(membershipRoles.includes(role), 'invalidMembership');
    const isGuardian = role === 'guardian' || role === 'representative';
    requireRule(
      !childId || (isGuardian && n.children.some((c) => c.id === childId && currentChild(n, c))),
      'invalidMembership',
    );
    if (role === 'teacher' || role === 'representative')
      requireRule(currentClass(n, classId), 'invalidMembership');
    if (role === 'representative')
      requireRule(
        n.children.some((c) => c.id === childId && c.classId === classId),
        'invalidRepresentative',
      );
    const selectedServices: Service[] =
      role === 'service' ? unique<Service>(options.services ?? ['care']) : [];
    requireRule(
      selectedServices.every((v) => serviceIds.includes(v)) &&
        (role !== 'service' || selectedServices.length),
      'invalidMembership',
    );
    const id = uid();
    const b: Adult = {
      id,
      name: name.trim(),
      roles: role === 'representative' ? ['guardian', 'representative'] : [role],
      status: 'invited',
      children: [],
      classes: role === 'teacher' ? [classId] : [],
      services: selectedServices,
      reviewers: [],
      representativeClasses: role === 'representative' ? [classId] : [],
      mandateEnd: schoolEnd(n),
      locale: 'fr',
      contact: options.contact?.trim() || `${id}@example.invalid`,
      quietStart: 20,
      quietEnd: 7,
      eventReminder: 24,
      taskReminders: true,
      notificationCategories: [
        'post',
        'form',
        'evaluation',
        'poll',
        'event',
        'topic',
        'conversation',
        'request',
      ],
      availableStart: 8,
      availableEnd: 18,
      verifiedBy: a.id,
      year: n.year,
    };
    requireRule(b.contact.length <= 250, 'invalidMembership');
    n.adults.push(b);
    setGuardianLinks(n, b, childId ? [childId] : []);
  });
}
export interface PupilInput {
  name: string;
  dob: string;
  classId: string;
  guardians?: string[];
  services?: Service[];
}
function freshChild(s: State, input: PupilInput): Child {
  requireRule(input.name.trim() && input.name.length <= 160, 'required');
  requireRule(validDate(input.dob) && input.dob <= s.clock.slice(0, 10), 'invalidBirthDate');
  requireRule(currentClass(s, input.classId), 'invalidMembership');
  requireRule(
    !s.children.some(
      (c) =>
        c.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase() &&
        c.dob === input.dob,
    ),
    'duplicate',
  );
  return {
    id: uid(),
    name: input.name.trim(),
    dob: input.dob,
    classId: input.classId,
    year: s.year,
    guardians: [],
    services: [],
    emergency: '',
    collectors: '',
    care: tr('', ''),
    reviewedCare: tr('', ''),
    careStatus: 'reported',
    diet: tr('', ''),
    familyDiet: tr('', ''),
    support: tr('', ''),
    vaccination: 'awaiting',
    evidence: [],
    consents: { class: {}, school: {}, print: {}, website: {}, social: {} },
    consentVersion: 1,
  };
}
function setChildLinks(s: State, c: Child, ids: string[]) {
  requireRule(
    ids.every((id) =>
      s.adults.some((p) => p.id === id && p.roles.includes('guardian') && p.year === s.year),
    ),
    'invalidMembership',
  );
  const before = [...c.guardians];
  c.guardians = unique(ids);
  for (const p of s.adults) {
    p.children = p.children.filter((id) => id !== c.id);
    if (c.guardians.includes(p.id)) p.children.push(c.id);
  }
  for (const id of c.guardians.filter((id) => !before.includes(id)))
    photoUses.forEach((use) => {
      c.consents[use][id] = 'awaiting';
    });
  if (before.slice().sort().join() !== c.guardians.slice().sort().join()) c.consentVersion++;
}
export function createChild(s: State, actor: string, input: PupilInput) {
  return change(s, actor, 'pupilCreated', input.classId, (n, a) => {
    requireRule(canManageClass(n, a, input.classId));
    requireRule(director(n, a) || (!input.guardians?.length && !input.services?.length));
    const c = freshChild(n, input);
    requireRule(
      (input.services ?? []).every((v) => serviceIds.includes(v)),
      'invalidMembership',
    );
    c.services = unique(input.services ?? []);
    n.children.push(c);
    if (director(n, a)) setChildLinks(n, c, input.guardians ?? []);
    else
      n.tasks.push({
        id: uid(),
        childId: c.id,
        type: 'correction',
        author: a.id,
        staff: n.adults.filter((p) => director(n, p)).map((p) => p.id),
        at: n.clock,
        status: 'pending',
        note: 'Nouveau dossier élève : vérifier les liens familiaux et les services.',
      });
  });
}
export function editChild(s: State, actor: string, id: string, input: Omit<PupilInput, 'classId'>) {
  return change(s, actor, 'pupilUpdated', id, (n, a) => {
    const c = n.children.find((p) => p.id === id);
    requireRule(c && currentChild(n, c) && (director(n, a) || teaches(n, a, c)));
    requireRule(director(n, a) || (input.guardians === undefined && input.services === undefined));
    requireRule(input.name.trim() && input.name.length <= 160, 'required');
    requireRule(validDate(input.dob) && input.dob <= n.clock.slice(0, 10), 'invalidBirthDate');
    requireRule(
      !n.children.some(
        (p) =>
          p.id !== id &&
          p.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase() &&
          p.dob === input.dob,
      ),
      'duplicate',
    );
    c.name = input.name.trim();
    c.dob = input.dob;
    if (input.guardians) setChildLinks(n, c, input.guardians);
    if (input.services) {
      requireRule(
        input.services.every((v) => serviceIds.includes(v)),
        'invalidMembership',
      );
      c.services = unique(input.services);
    }
    pruneMandates(n);
  });
}
export function moveChild(
  s: State,
  actor: string,
  id: string,
  classId: string,
  services: Service[],
) {
  return change(s, actor, 'childMembership', id, (n, a) => {
    const c = n.children.find((c) => c.id === id);
    requireRule(c && currentChild(n, c) && (director(n, a) || teaches(n, a, c)));
    requireRule(
      currentClass(n, classId) && services.every((v) => serviceIds.includes(v)),
      'invalidMembership',
    );
    requireRule(
      director(n, a) || services.slice().sort().join() === c.services.slice().sort().join(),
    );
    c.classId = classId;
    c.services = unique(services);
    delete c.unassignedAt;
    delete c.removalReason;
    pruneMandates(n);
  });
}
export function removeFromClass(s: State, actor: string, id: string, reason: string) {
  return change(s, actor, 'pupilUnassigned', id, (n, a) => {
    const c = n.children.find((p) => p.id === id);
    requireRule(c && currentChild(n, c) && c.classId && (director(n, a) || teaches(n, a, c)));
    requireRule(reason.trim(), 'required');
    c.classId = '';
    c.unassignedAt = n.clock;
    c.removalReason = reason.trim();
    pruneMandates(n);
    n.tasks.push({
      id: uid(),
      childId: c.id,
      type: 'correction',
      author: a.id,
      staff: n.adults.filter((p) => director(n, p)).map((p) => p.id),
      at: n.clock,
      status: 'pending',
      note: 'Élève retiré de sa classe : une réaffectation est à vérifier.',
    });
  });
}
export function archiveChild(s: State, actor: string, id: string, reason: string) {
  return change(s, actor, 'pupilArchived', id, (n, a) => {
    requireRule(director(n, a));
    const c = n.children.find((p) => p.id === id);
    requireRule(c && currentChild(n, c));
    requireRule(reason.trim(), 'required');
    c.archived = true;
    c.archivedAt = n.clock;
    c.removalReason = reason.trim();
    pruneMandates(n);
  });
}
export function restoreChild(s: State, actor: string, id: string, classId: string) {
  return change(s, actor, 'pupilRestored', id, (n, a) => {
    requireRule(director(n, a));
    const c = n.children.find((p) => p.id === id);
    requireRule(c?.archived && currentClass(n, classId));
    c.archived = false;
    c.year = n.year;
    c.classId = classId;
    delete c.archivedAt;
    delete c.unassignedAt;
    delete c.removalReason;
    photoUses.forEach((use) =>
      c.guardians.forEach((id) => {
        c.consents[use][id] = 'awaiting';
      }),
    );
    c.consentVersion++;
  });
}
export function setRepresentative(
  s: State,
  actor: string,
  id: string,
  classId: string,
  enabled: boolean,
  end: string,
) {
  return change(s, actor, 'representativeMandate', classId, (n, a) => {
    requireRule(canManageClass(n, a, classId));
    const p = n.adults.find((p) => p.id === id);
    requireRule(p);
    if (enabled) {
      requireRule(
        active(n, p) && guardianChildren(n, p).some((c) => c.classId === classId),
        'invalidRepresentative',
      );
      validateMandate(n, end);
      p.representativeClasses = unique([...p.representativeClasses, classId]);
      p.mandateEnds = { ...p.mandateEnds, [classId]: end };
      p.roles = unique([...p.roles, 'representative']);
    } else {
      requireRule(p.representativeClasses.includes(classId), 'invalidRepresentative');
      p.representativeClasses = p.representativeClasses.filter((id) => id !== classId);
      if (p.mandateEnds) delete p.mandateEnds[classId];
      if (!p.representativeClasses.length) p.roles = p.roles.filter((r) => r !== 'representative');
    }
    p.verifiedBy = a.id;
  });
}
export function rollover(s: State, actor: string) {
  return change(s, actor, 'rollover', 'year', (n, a) => {
    requireRule(director(n, a));
    const year = Number(n.year.slice(0, 4)) + 1;
    n.archive.push({ year: n.year, at: n.clock, classes: n.classes.map((c) => c.name) });
    n.year = `${year}–${year + 1}`;
    n.classes.forEach((c) => {
      c.year = n.year;
    });
    n.adults.forEach((p) => {
      p.year = n.year;
      p.representativeClasses = [];
      p.mandateEnds = {};
      p.roles = p.roles.filter((r) => r !== 'representative');
      p.classes = [];
    });
    n.children.forEach((c) => {
      c.year = n.year;
      c.careStatus = 'reported';
      (Object.keys(c.consents) as PhotoUse[]).forEach((use) => {
        Object.keys(c.consents[use]).forEach((g) => (c.consents[use][g] = 'awaiting'));
      });
      c.consentVersion++;
    });
    n.entries
      .filter((e) => !['evaluation', 'conversation', 'request'].includes(e.kind))
      .forEach((e) => (e.status = 'archived'));
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
    Object.assign(a, patch);
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
export function createClass(s: State, actor: string, name: string) {
  return change(s, actor, 'class', 'new', (n, a) => {
    requireRule(director(n, a) && name.trim(), 'required');
    n.classes.push({ id: uid(), name, year: n.year, archived: false });
  });
}
export function reviewEvidence(s: State, actor: string, childId: string) {
  return change(s, actor, 'evidenceReview', childId, (n, a) => {
    requireRule(a.reviewers.includes(childId));
    const c = n.children.find((c) => c.id === childId);
    requireRule(c);
    c.vaccination = 'reviewed';
  });
}
export function importChildren(
  s: State,
  actor: string,
  rows: { name: string; classId: string; dob: string }[],
) {
  return change(s, actor, 'import', 'children', (n, a) => {
    requireRule(director(n, a));
    requireRule(
      rows.length > 0 &&
        rows.every(
          (r) =>
            r.name.trim() &&
            /^\d{4}-\d{2}-\d{2}$/.test(r.dob) &&
            n.classes.some((c) => c.id === r.classId && !c.archived),
        ),
      'invalidImport',
    );
    requireRule(
      new Set(rows.map((r) => r.name.toLocaleLowerCase())).size === rows.length &&
        !rows.some((r) =>
          n.children.some((c) => c.name.toLocaleLowerCase() === r.name.toLocaleLowerCase()),
        ),
      'duplicate',
    );
    rows.forEach((r) => n.children.push(freshChild(n, r)));
  });
}
// This UI audit projection excludes respondent identities for anonymous-answer operations.
export function auditView(s: State, a: Adult) {
  requireRule(director(s, a));
  return s.audit
    .filter((x) => x.action !== 'pollResponse' && x.action !== 'message' && x.action !== 'draft')
    .map((x) => ({
      ...x,
      resource:
        s.entries.find((e) => e.id === x.resource && canRead(s, a, e))?.title ??
        s.children.find((c) => c.id === x.resource)?.name ??
        s.adults.find((p) => p.id === x.resource)?.name ??
        s.classes.find((c) => c.id === x.resource)?.name ??
        '—',
    }));
}

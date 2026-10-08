import { describe, expect, it } from 'vitest';
import { seed } from '../src/data/seed';
import { demoPortrait } from '../src/data/portraits';
import { upgradeClassRoster } from '../src/data/classes';
import type { State, ProfileTarget } from '../src/domain/types';
import {
  createChild,
  editChild,
  moveChild,
  removeFromClass,
  archiveChild,
  restoreChild,
  setRepresentative,
  adminAdult,
  removeAdult,
  invite,
  importChildren,
  setProfilePhoto,
} from '../src/domain/engine';
import {
  childrenFor,
  canReadFile,
  canManageProfilePhoto,
  represents,
  guardian,
  teaches,
  canRead,
  mandateEndFor,
} from '../src/domain/policy';
const setup = () => seed('2026-10-08T08:00:00.000Z');
const adult = (s: State, id: string) => s.adults.find((p) => p.id === id)!;
const child = (s: State, id: string) => s.children.find((c) => c.id === id)!;
const input = { name: 'Élève Exemple', dob: '2019-04-12', classId: 'ce' };
const target: ProfileTarget = { kind: 'child', id: 'c1' };
const photo = { id: 'portrait-test', name: 'portrait.png', type: 'image/png', size: 1000 };

describe('school administration boundaries and record preservation', () => {
  it('upgrades older class groups once without changing pupils, staff, files or saved work', () => {
    const s = setup();
    s.seedVersion = 1;
    s.classes = s.classes.filter((g) => g.id !== 'ce2cm1');
    s.classes.find((g) => g.id === 'ps')!.name = 'PS / MS';
    s.classes.find((g) => g.id === 'cp')!.name = 'GS / CP';
    s.drafts['alice:message'] = 'Brouillon conservé';
    child(s, 'c1').demoPhotoHidden = true;
    const before = structuredClone(s);
    const n = upgradeClassRoster(s);
    expect(n.classes.map((g) => g.name)).toEqual([
      'PS / MS / GS',
      'CP / CE1',
      'CE1 / CE2',
      'CE2 / CM1',
      'CM1 / CM2',
    ]);
    expect({ ...n, classes: s.classes, seedVersion: 1, revision: s.revision }).toEqual(s);
    expect(s).toEqual(before);
    expect(upgradeClassRoster(n)).toBe(n);
    n.classes = n.classes.filter((g) => g.id !== 'ce2cm1');
    expect(upgradeClassRoster(n).classes).toHaveLength(4);
  });
  it('preserves custom and archived groups and reuses an existing CE2/CM1 group', () => {
    const s = setup();
    s.seedVersion = 1;
    s.classes.find((g) => g.id === 'ps')!.name = 'Maternelle personnalisée';
    s.classes.find((g) => g.id === 'cp')!.archived = true;
    const existing = s.classes.find((g) => g.id === 'ce2cm1')!;
    existing.id = 'existing-group';
    existing.name = 'CE2/CM1';
    const n = upgradeClassRoster(s);
    expect(n.classes).toEqual(s.classes);
    expect(n.classes).toHaveLength(5);
    existing.archived = true;
    existing.id = 'ce2cm1';
    const withArchive = upgradeClassRoster(s);
    expect(withArchive.classes.filter((g) => g.name.replace(/\s/g, '') === 'CE2/CM1')).toHaveLength(
      2,
    );
    expect(new Set(withArchive.classes.map((g) => g.id)).size).toBe(withArchive.classes.length);
  });
  it('creates blank pupil records within teaching scope and validates actual birth dates', () => {
    const s = setup();
    const n = createChild(s, 'emma', input);
    const c = n.children.at(-1)!;
    expect(c).toMatchObject({
      name: input.name,
      classId: 'ce',
      guardians: [],
      services: [],
      evidence: [],
      care: { fr: '', en: '' },
      support: { fr: '', en: '' },
      vaccination: 'awaiting',
      consents: { class: {} },
    });
    expect(n.tasks.at(-1)?.childId).toBe(c.id);
    expect(() => createChild(s, 'emma', { ...input, classId: 'cm' })).toThrow('denied');
    expect(() => createChild(s, 'emma', { ...input, guardians: ['alice'] })).toThrow('denied');
    expect(() => createChild(s, 'alice', input)).toThrow('denied');
    expect(() => createChild(s, 'director', { ...input, dob: '2020-02-30' })).toThrow(
      'invalidBirthDate',
    );
    expect(() => createChild(s, 'director', { ...input, dob: '2030-01-01' })).toThrow(
      'invalidBirthDate',
    );
    const imported = importChildren(s, 'director', [input]).children.at(-1)!;
    expect(imported.reviewedCare.fr).toBe('');
    expect(imported.diet.fr).toBe('');
    expect(imported.emergency).toBe('');
  });
  it('direction links parents reciprocally without granting publication consent', () => {
    const n = createChild(setup(), 'director', {
      ...input,
      guardians: ['alice'],
      services: ['care'],
    });
    const c = n.children.at(-1)!;
    expect(guardian(n, adult(n, 'alice'), c)).toBe(true);
    expect(c.consents.class.alice).toBe('awaiting');
    const edited = editChild(n, 'director', c.id, {
      name: 'Élève Renommé',
      dob: c.dob,
      guardians: ['thomas'],
    });
    expect(adult(edited, 'alice').children).not.toContain(c.id);
    expect(adult(edited, 'thomas').children).toContain(c.id);
    expect(() => editChild(n, 'emma', c.id, { name: c.name, dob: c.dob, guardians: [] })).toThrow(
      'denied',
    );
  });
  it('transfers the existing record, attachments and history while changing teacher access', () => {
    const s = setProfilePhoto(setup(), 'emma', target, photo);
    const c = child(s, 'c1');
    const moved = moveChild(s, 'emma', c.id, 'cm', c.services);
    expect(child(moved, c.id)).toEqual({ ...c, classId: 'cm' });
    expect(moved.entries).toEqual(s.entries);
    expect(moved.attachments).toEqual(s.attachments);
    expect(moved.submissions).toEqual(s.submissions);
    expect(teaches(moved, adult(moved, 'emma'), child(moved, c.id))).toBe(false);
    expect(teaches(moved, adult(moved, 'leonie'), child(moved, c.id))).toBe(true);
    expect(canReadFile(moved, adult(moved, 'emma'), moved.attachments.at(-1)!)).toBe(false);
    expect(canReadFile(moved, adult(moved, 'leonie'), moved.attachments.at(-1)!)).toBe(true);
    expect(() => moveChild(moved, 'emma', c.id, 'ce', c.services)).toThrow('denied');
    expect(() => moveChild(s, 'emma', c.id, 'cm', [])).toThrow('denied');
  });
  it('teacher removals retain school enrolment; direction controls reassignment and departure', () => {
    const s = setup();
    const original = child(s, 'c1');
    const n = removeFromClass(s, 'emma', 'c1', 'Réaffectation demandée');
    expect(child(n, 'c1').classId).toBe('');
    expect(guardian(n, adult(n, 'alice'), child(n, 'c1'))).toBe(true);
    expect(child(n, 'c1').services).toEqual(original.services);
    expect(childrenFor(n, adult(n, 'emma')).map((c) => c.id)).not.toContain('c1');
    expect(childrenFor(n, adult(n, 'director')).map((c) => c.id)).toContain('c1');
    expect(() => archiveChild(s, 'emma', 'c1', 'Départ')).toThrow('denied');
    expect(() => moveChild(n, 'emma', 'c1', 'ce', original.services)).toThrow('denied');
    const archived = archiveChild(
      moveChild(n, 'director', 'c1', 'cm', original.services),
      'director',
      'c1',
      'Départ',
    );
    expect(archived.entries).toEqual(s.entries);
    expect(childrenFor(archived, adult(archived, 'alice')).map((c) => c.id)).not.toContain('c1');
    const restored = restoreChild(archived, 'director', 'c1', 'ce');
    expect(child(restored, 'c1').id).toBe(original.id);
    expect(child(restored, 'c1').consents.class.alice).toBe('awaiting');
  });
  it('mandates are independently scoped, preserve parent rights and end when the last child leaves', () => {
    let s = setup();
    s = setRepresentative(s, 'emma', 'alice', 'ce', true, '2027-06-30');
    s = setRepresentative(s, 'emma', 'alice', 'cp', true, '2027-07-31');
    expect(() => setRepresentative(s, 'hugo', 'alice', 'cp', false, '')).toThrow('denied');
    expect(() => setRepresentative(s, 'emma', 'luc', 'ce', true, '2027-06-30')).toThrow(
      'invalidRepresentative',
    );
    s = adminAdult(s, 'director', 'alice', {
      name: 'Alice Exemple',
      representativeClasses: ['ce', 'cp'],
    });
    expect(mandateEndFor(adult(s, 'alice'), 'ce')).toBe('2027-06-30');
    expect(mandateEndFor(adult(s, 'alice'), 'cp')).toBe('2027-07-31');
    s = moveChild(s, 'emma', 'c1', 'cm', child(s, 'c1').services);
    expect(represents(s, adult(s, 'alice'), 'ce')).toBe(false);
    expect(represents(s, adult(s, 'alice'), 'cp')).toBe(true);
    s = setRepresentative(s, 'emma', 'alice', 'cp', false, '');
    expect(adult(s, 'alice').roles).toContain('guardian');
    expect(adult(s, 'alice').roles).not.toContain('representative');
    expect(guardian(s, adult(s, 'alice'), child(s, 'c1'))).toBe(true);
  });
  it('direction manages invitations and removes access without deleting contributions', () => {
    let s = setup();
    expect(() => invite(s, 'emma', 'Autre enseignant', 'teacher', '', 'ce')).toThrow('denied');
    expect(() => removeAdult(s, 'director', 'director', 'Retrait')).toThrow('protectedAccount');
    s = invite(s, 'director', 'Agent Exemple', 'service', '', '', {
      services: ['transport'],
      contact: 'agent@example.invalid',
    });
    expect(s.adults.at(-1)).toMatchObject({
      roles: ['service'],
      services: ['transport'],
      status: 'invited',
      reviewers: [],
      children: [],
    });
    const n = removeAdult(s, 'director', 'alice', 'Fin d’accès');
    expect(n.entries).toEqual(s.entries);
    expect(adult(n, 'alice').status).toBe('revoked');
    expect(canRead(n, adult(n, 'alice'), n.entries[0])).toBe(false);
    expect(() => adminAdult(s, 'emma', 'alice', { roles: ['director'] })).toThrow('denied');
  });
});

describe('private profile photos', () => {
  it('adds fictional defaults to only the seeded pupils and eligible staff without changing state', () => {
    const s = setup();
    const before = structuredClone(s);
    const director = adult(s, 'director');
    expect(
      s.children.filter((c) => demoPortrait(s, director, { kind: 'child', id: c.id })),
    ).toHaveLength(12);
    expect(
      s.adults.filter((p) => demoPortrait(s, director, { kind: 'adult', id: p.id })),
    ).toHaveLength(7);
    expect(demoPortrait(s, director, { kind: 'adult', id: 'alice' })).toBeUndefined();
    expect(demoPortrait(s, director, { kind: 'adult', id: 'c1' })).toBeUndefined();
    expect(s).toEqual(before);
    const n = createChild(s, 'emma', input);
    expect(demoPortrait(n, director, { kind: 'child', id: n.children.at(-1)!.id })).toBeUndefined();
  });
  it('uses profile visibility for defaults including combined parent/staff roles', () => {
    const s = setup();
    expect(demoPortrait(s, adult(s, 'alice'), target)).toMatch(/portraits\/c1\.webp$/);
    expect(demoPortrait(s, adult(s, 'ines'), target)).toBeUndefined();
    adult(s, 'alice').status = 'suspended';
    expect(demoPortrait(s, adult(s, 'alice'), target)).toBeUndefined();
    adult(s, 'emma').roles.push('guardian');
    expect(demoPortrait(s, adult(s, 'director'), { kind: 'adult', id: 'emma' })).toBeDefined();
    expect(demoPortrait(s, adult(s, 'ines'), { kind: 'adult', id: 'emma' })).toBeUndefined();
  });
  it('preserves uploaded photos and remembers removal of both pupil and staff defaults', () => {
    for (const t of [target, { kind: 'adult', id: 'emma' } as const]) {
      const s = setup();
      const n = setProfilePhoto(s, 'director', t, photo);
      expect(demoPortrait(n, adult(n, 'director'), t)).toBeUndefined();
      const removedUpload = setProfilePhoto(n, 'director', t, null);
      expect(demoPortrait(removedUpload, adult(removedUpload, 'director'), t)).toBeUndefined();
      const removedDefault = setProfilePhoto(s, 'director', t, null);
      removedDefault.audit = [];
      expect(demoPortrait(removedDefault, adult(removedDefault, 'director'), t)).toBeUndefined();
      expect(demoPortrait(s, adult(s, 'director'), t)).toBeDefined();
    }
  });
  it('respects photo removals saved by earlier releases', () => {
    const s = setProfilePhoto(setup(), 'emma', target, null);
    delete child(s, 'c1').demoPhotoHidden;
    expect(demoPortrait(s, adult(s, 'director'), target)).toBeUndefined();
    expect(demoPortrait(s, adult(s, 'director'), { kind: 'child', id: 'c2' })).toBeDefined();
  });
  it('allows direction, assigned teachers and adult self-service without parent access to child photos', () => {
    const s = setup();
    expect(canManageProfilePhoto(s, adult(s, 'director'), target)).toBe(true);
    expect(canManageProfilePhoto(s, adult(s, 'emma'), target)).toBe(true);
    for (const id of ['alice', 'ines', 'nora', 'leonie'])
      expect(() => setProfilePhoto(s, id, target, photo)).toThrow('denied');
    for (const actor of ['director', 'alice'])
      expect(
        setProfilePhoto(s, actor, { kind: 'adult', id: 'alice' }, photo).adults.find(
          (p) => p.id === 'alice',
        )?.photoId,
      ).toBe(photo.id);
    expect(() => setProfilePhoto(s, 'emma', { kind: 'adult', id: 'hugo' }, photo)).toThrow(
      'denied',
    );
    expect(
      setProfilePhoto(s, 'nora', { kind: 'adult', id: 'nora' }, photo).adults.find(
        (p) => p.id === 'nora',
      )?.photoId,
    ).toBe(photo.id);
  });
  it('does not grant publication consent and denies stale/replaced/removed attachments', () => {
    const s = setup();
    const before = structuredClone(child(s, 'c1').consents);
    const n = setProfilePhoto(s, 'emma', target, photo);
    const file = n.attachments.at(-1)!;
    expect(child(n, 'c1').consents).toEqual(before);
    expect(canReadFile(n, adult(n, 'alice'), file)).toBe(true);
    expect(canReadFile(n, adult(n, 'ines'), file)).toBe(false);
    const replaced = setProfilePhoto(n, 'emma', target, { ...photo, id: 'replacement' });
    expect(canReadFile(replaced, adult(replaced, 'alice'), file)).toBe(false);
    expect(replaced.attachments.some((f) => f.id === file.id)).toBe(false);
    const removed = setProfilePhoto(replaced, 'emma', target, null);
    expect(child(removed, 'c1').photoId).toBeUndefined();
    expect(canReadFile(removed, adult(removed, 'alice'), replaced.attachments.at(-1)!)).toBe(false);
    expect(() => setProfilePhoto(s, 'emma', target, { ...photo, type: 'image/svg+xml' })).toThrow(
      'profilePhotoType',
    );
    expect(() => setProfilePhoto(s, 'emma', target, { ...photo, size: 6 * 1024 * 1024 })).toThrow(
      'profilePhotoSize',
    );
  });
  it('preserves uploaded photos when a guardian role is assigned with owner and direction access', () => {
    let s = setProfilePhoto(setup(), 'director', { kind: 'adult', id: 'emma' }, photo);
    const file = s.attachments.at(-1)!;
    s = adminAdult(s, 'director', 'emma', { roles: ['teacher', 'guardian'] });
    expect(adult(s, 'emma').photoId).toBe(photo.id);
    expect(canReadFile(s, adult(s, 'emma'), file)).toBe(true);
    expect(canReadFile(s, adult(s, 'director'), file)).toBe(true);
    expect(canReadFile(s, adult(s, 'alice'), file)).toBe(false);
    expect(canManageProfilePhoto(s, adult(s, 'director'), { kind: 'adult', id: 'emma' })).toBe(
      true,
    );
  });
  it('keeps parent portraits scoped to their owner and direction, including direct file access', () => {
    for (const id of ['alice', 'ines']) {
      const parentTarget: ProfileTarget = { kind: 'adult', id };
      let s = setProfilePhoto(setup(), id, parentTarget, photo);
      const file = s.attachments.at(-1)!;
      expect(canReadFile(s, adult(s, id), file)).toBe(true);
      expect(canReadFile(s, adult(s, 'director'), file)).toBe(true);
      for (const other of ['thomas', 'luc', 'emma', 'nora']) {
        expect(canReadFile(s, adult(s, other), file)).toBe(false);
        expect(() => setProfilePhoto(s, other, parentTarget, null)).toThrow('denied');
      }
      s = setProfilePhoto(s, id, parentTarget, null);
      expect(canReadFile(s, adult(s, id), file)).toBe(false);
      s = adminAdult(s, 'director', id, { status: 'suspended' });
      expect(() => setProfilePhoto(s, id, parentTarget, photo)).toThrow('denied');
    }
  });
});

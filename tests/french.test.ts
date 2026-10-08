import { describe, expect, it } from 'vitest';
import { seed } from '../src/data/seed';
import { upgradeDemoFrench } from '../src/data/french';

describe('French-only demo content upgrade', () => {
  it('cleans original content and prefilled copies without changing local edits or records', () => {
    const s = seed('2026-10-06T08:00:00Z');
    s.children[0].collectors = 'Responsables légaux / Legal guardians';
    s.children[1].collectors = 'Marie / Paul — contact familial';
    s.entries.find((e) => e.id === 'teacher-chat')!.messages[0].text =
      'Le départ est prévu après l’accueil. / We will leave after morning registration.';
    s.entries.find((e) => e.id === 'nature')!.location = 'Parc fictif / Fictional park';
    s.entries.find((e) => e.id === 'meeting')!.location = 'École · Démo / School · Demo';
    s.entries.find((e) => e.id === 'collection')!.requestDetails = 'Tante fictive / Fictional aunt';
    s.entries.find((e) => e.id === 'topic')!.messages[0].text =
      'Un temps pour parler des livres / Time to talk about books';
    s.entries.find((e) => e.id === 'team-chat')!.messages[0].text =
      'Une question sur l’accueil du soir. / A question about after-school care.';
    s.entries[0].reviewNote = 'Photo : accord à revérifier / Photo: permission must be reviewed';
    s.submissions[0].answers.collectors = s.children[0].collectors;
    s.submissions[0].history.push({
      answers: { collectors: s.children[0].collectors },
      at: s.clock,
      version: 1,
    });
    s.drafts.alice = 'Please keep this locally written draft / brouillon';
    s.attachments.find((f) => f.id === 'sample-photo')!.name = 'sample-image.png';
    const before = structuredClone(s);
    const n = upgradeDemoFrench(s);
    const expected = structuredClone(s);
    expected.children[0].collectors = 'Responsables légaux';
    expected.entries.find((e) => e.id === 'teacher-chat')!.messages[0].text =
      'Le départ est prévu après l’accueil.';
    expected.entries.find((e) => e.id === 'nature')!.location = 'Parc fictif';
    expected.entries.find((e) => e.id === 'meeting')!.location = 'École · Démo';
    expected.entries.find((e) => e.id === 'collection')!.requestDetails = 'Tante fictive';
    expected.entries.find((e) => e.id === 'topic')!.messages[0].text =
      'Un temps pour parler des livres';
    expected.entries.find((e) => e.id === 'team-chat')!.messages[0].text =
      'Une question sur l’accueil du soir.';
    expected.entries[0].reviewNote = 'Photo : accord à revérifier';
    expected.submissions[0].answers.collectors = 'Responsables légaux';
    expected.submissions[0].history[0].answers.collectors = 'Responsables légaux';
    expected.attachments.find((f) => f.id === 'sample-photo')!.name = 'illustration-fictive.png';
    expected.revision++;
    expect(n).toEqual(expected);
    expect(s).toEqual(before);
    expect(upgradeDemoFrench(n)).toBe(n);
  });

  it('does not rewrite fresh data or edited sample labels', () => {
    const s = seed();
    s.attachments.find((f) => f.id === 'sample-photo')!.name = 'Mon illustration.png';
    s.entries.find((e) => e.id === 'nature')!.location =
      'Parc fictif / Fictional park, entrée nord';
    expect(upgradeDemoFrench(s)).toBe(s);
  });
});

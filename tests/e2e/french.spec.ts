import { test, expect, type Page } from '@playwright/test';
import type { State } from '../../src/domain/types';

const boot = async (page: Page) => {
  await page.clock.setFixedTime(new Date('2026-10-06T08:00:00Z'));
  await page.goto('./');
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Bienvenue');
  await expect(page.getByRole('dialog')).not.toContainText('Welcome');
  await page.getByRole('button', { name: 'Explorer la démo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Alice,' })).toBeVisible();
};

test('sample details, messages and event locations have no inline English translations', async ({
  page,
}) => {
  await boot(page);
  await page.goto('./#/children/c1');
  await expect(page.getByText('Choisir un fichier', { exact: true })).toBeVisible();
  await expect(page.getByText('Aucun fichier sélectionné', { exact: true })).toBeVisible();
  const upload = page.getByLabel('Ajouter un justificatif fictif', { exact: true });
  await upload.focus();
  const chooser = page.waitForEvent('filechooser');
  await upload.press('Space');
  expect((await chooser).isMultiple()).toBe(false);
  for (const [route, text] of [
    ['children/c1', 'Responsables légaux'],
    ['conversation/teacher-chat', 'Le départ est prévu après l’accueil.'],
    ['conversation/team-chat', 'Une question sur l’accueil du soir.'],
    ['topic/topic', 'Un temps pour parler des livres'],
    ['request/collection', 'Tante fictive'],
    ['event/nature', 'Parc fictif'],
    ['event/meeting', 'École · Démo'],
  ]) {
    await page.goto(`./#/${route}`);
    await expect(page.locator('main')).toContainText(text);
    await expect(page.locator('main')).not.toContainText(
      /Legal guardians|We will leave|A question about|Time to talk|Fictional aunt|Fictional park|School · Demo/,
    );
  }
  const response = await page.request.get('./sample-calendar.ics');
  expect(await response.text()).toContain('SUMMARY:DÉMO - Journée du livre');
  expect(await response.text()).not.toMatch(/Book day|fictional|browser edits/);
});

test('saved bilingual sample text is upgraded while custom content and uploaded bytes survive', async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('peyrieu-school-demo-v1');
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction(['state', 'files'], 'readwrite');
    const store = tx.objectStore('state');
    const request = store.get('current');
    request.onsuccess = () => {
      const s = request.result as State;
      s.children[0].collectors = 'Responsables légaux / Legal guardians';
      s.children[1].collectors = 'Marie / Paul — contact familial';
      s.drafts.alice = 'My own text / mon texte';
      store.put(s, 'current');
    };
    // Even a locally replaced sample is preserved unless its bytes match the original.
    tx.objectStore('files').put(
      { bytes: new TextEncoder().encode('custom upload').buffer, type: 'image/png' },
      'sample-photo',
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto('./#/children/c1');
  await page.reload();
  await expect(page.getByText('Responsables légaux', { exact: true })).toBeVisible();
  await page.goto('./#/children/c2');
  await expect(page.getByText('Marie / Paul — contact familial', { exact: true })).toBeVisible();
  await page.reload();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('peyrieu-school-demo-v1');
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction(['state', 'files'], 'readonly');
    const read = (store: string, key: string) =>
      new Promise<unknown>((resolve) => {
        const request = tx.objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
      });
    const [state, file] = await Promise.all([
      read('state', 'current'),
      read('files', 'sample-photo'),
    ]);
    db.close();
    return {
      collectors: (state as State).children[0].collectors,
      draft: (state as State).drafts.alice,
      file: new TextDecoder().decode((file as { bytes: ArrayBuffer }).bytes),
    };
  });
  expect(saved).toEqual({
    collectors: 'Responsables légaux',
    draft: 'My own text / mon texte',
    file: 'custom upload',
  });
});

test('previous English preferences open in French without clearing stored content', async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('peyrieu-school-demo-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('state', 'readwrite');
    const store = tx.objectStore('state');
    const request = store.get('current');
    request.onsuccess = () => {
      const s = request.result as State;
      s.adults.forEach((adult) => {
        adult.locale = 'en';
      });
      const entry = s.entries.find((entry) => entry.id === 'teacher-chat')!;
      entry.title = {
        fr: 'Message conservé après la mise à jour',
        en: 'Previously translated title',
      };
      entry.body = {
        fr: 'Le contenu local est toujours présent.',
        en: 'Previously translated content',
      };
      store.put(s, 'current');
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  for (const actor of ['alice', 'emma']) {
    await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption(actor);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page).toHaveTitle('École de Peyrieu · Démo');
    await expect(
      page.getByRole('button', { name: /Switch to English|Passer en français/ }),
    ).toHaveCount(0);
    await page.goto('./#/conversation/teacher-chat');
    await expect(
      page.getByRole('heading', { name: 'Message conservé après la mise à jour' }),
    ).toBeVisible();
    await expect(
      page.getByText('Le contenu local est toujours présent.', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Previously translated');
  }
});

test('French form questions and poll choices publish and reopen without translation fields', async ({
  page,
}) => {
  await boot(page);
  await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption('emma');
  await page.goto('./#/forms');
  await page.getByRole('button', { name: 'Créer une démarche', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByLabel(/anglais|français/i)).toHaveCount(0);
  await editor.getByLabel('Titre *', { exact: true }).fill('Démarche en français');
  const question = editor
    .locator('.question-editor')
    .filter({ has: page.getByLabel('Options, une par ligne', { exact: true }) });
  await expect(question.getByLabel('Options, une par ligne')).toHaveValue('Non\nOui');
  await question.getByLabel('Libellé', { exact: true }).fill('Quel atelier préférez-vous ?');
  await question.getByLabel('Options, une par ligne').fill('Lecture | écriture\nArts plastiques');
  await editor.getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(editor.getByLabel('Titre *', { exact: true })).toHaveValue('Démarche en français');
  await expect(question.getByLabel('Libellé', { exact: true })).toHaveValue(
    'Quel atelier préférez-vous ?',
  );
  await expect(question.getByLabel('Options, une par ligne')).toHaveValue(
    'Lecture | écriture\nArts plastiques',
  );
  await page.keyboard.press('Escape');
  await page.goto('./#/surveys');
  await page.getByRole('button', { name: 'Créer une consultation', exact: true }).click();
  await expect(editor.getByLabel(/anglais|français/i)).toHaveCount(0);
  await editor.getByLabel('Titre *', { exact: true }).fill('Ateliers en français');
  await editor.getByLabel('Texte *', { exact: true }).fill('Choisissez un atelier.');
  await expect(editor.getByLabel('Choix, un par ligne')).toHaveValue('Oui\nNon');
  await editor.getByLabel('Choix, un par ligne').fill('Lecture | écriture\nArts plastiques');
  await editor.getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(editor).toHaveCount(0);
  const poll = page.url();
  await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption('alice');
  await page.goto(poll);
  await expect(page.getByRole('heading', { name: 'Ateliers en français' })).toBeVisible();
  await expect(page.getByLabel('Lecture | écriture', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Arts plastiques', { exact: true })).toBeVisible();
});

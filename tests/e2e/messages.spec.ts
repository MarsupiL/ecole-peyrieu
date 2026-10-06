import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { State } from '../../src/domain/types';

const boot = async (page: Page) => {
  await page.clock.setFixedTime(new Date('2026-10-06T08:00:00Z'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Explorer la démo · Explore demo' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Alice,' })).toBeVisible();
  await page.goto('./#/messages');
};

test('new messages stay blank; drafts are explicitly restored and cleared only after sending', async ({
  page,
}) => {
  await boot(page);
  const newMessage = page.getByRole('button', { name: 'Nouveau message', exact: true });
  await newMessage.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Objet', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('');
  await dialog
    .getByLabel('Message', { exact: true })
    .fill('Un brouillon à reprendre volontairement.');
  await dialog.getByRole('button', { name: 'Enregistrer le brouillon', exact: true }).click();
  await expect(page.getByText('Enregistré dans ce navigateur.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.reload();
  await newMessage.click();
  await expect(dialog.getByLabel('Objet', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Reprendre le texte du brouillon' }).click();
  await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue(
    'Un brouillon à reprendre volontairement.',
  );
  // An invalid send must preserve both the open input and the saved draft.
  await dialog.getByRole('button', { name: 'Envoyer dans la démo' }).click();
  await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue(
    'Un brouillon à reprendre volontairement.',
  );
  await dialog.getByLabel('Objet', { exact: true }).fill('Une nouvelle conversation');
  await dialog.getByLabel('Destinataire', { exact: true }).selectOption('emma');
  await dialog.getByRole('button', { name: 'Envoyer dans la démo' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.message-list > li').first().getByRole('button')).toHaveAccessibleName(
    'Une nouvelle conversation',
  );
  await newMessage.click();
  await expect(dialog.getByLabel('Objet', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Reprendre le texte du brouillon' })).toHaveCount(
    0,
  );
  await dialog.getByLabel('Message', { exact: true }).fill('Une saisie non envoyée.');
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await newMessage.click();
  await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('');
});

test('conversation rows search accessible content and participants, clear unread state and retain service filters', async ({
  page,
}) => {
  await boot(page);
  const rows = page.getByRole('list', { name: 'Conversations', exact: true });
  const search = page.getByRole('textbox', { name: 'Rechercher dans mes messages' });
  await search.fill('  emma laurent  ');
  await expect(rows.getByRole('listitem')).toHaveCount(1);
  const outing = rows.getByRole('button', { name: 'Une question sur la sortie', exact: true });
  await expect(outing.getByText('Non lu', { exact: true })).toBeVisible();
  await expect(outing).toHaveAccessibleDescription(/Emma Laurent/);
  await outing.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Une question sur la sortie', exact: true }),
  ).toBeVisible();
  await page.goto('./#/messages');
  await expect(outing.getByText('Non lu', { exact: true })).toHaveCount(0);
  await search.fill('depart est prevu');
  await expect(rows.getByRole('listitem')).toHaveCount(1);
  await search.fill('zz-no-conversation');
  await expect(
    page.getByText('Aucune conversation ne correspond à votre recherche.'),
  ).toBeVisible();
  await search.fill('');
  await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption('thomas');
  await page.goto('./#/messages');
  await expect(
    page.getByRole('button', { name: 'Une question sur la sortie', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption('nora');
  await page.goto('./#/messages');
  await page.getByLabel('Affectation', { exact: true }).selectOption('unassigned');
  await rows.getByRole('button', { name: 'Accueil du soir', exact: true }).click();
  await page.getByLabel('Personne en charge').selectOption('nora');
  await expect(page.getByText('Enregistré dans ce navigateur.', { exact: true })).toBeVisible();
  await page.goto('./#/messages');
  await page.getByLabel('Affectation', { exact: true }).selectOption('mine');
  await expect(rows.getByRole('listitem')).toHaveCount(1);
  await page.getByLabel('Affectation', { exact: true }).selectOption('unassigned');
  await expect(rows).toHaveCount(0);
});

test('a populated inbox stays compact and accessible across widths and both languages', async ({
  page,
}) => {
  await boot(page);
  // Populate this isolated test browser with accessible and inaccessible fixtures.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('peyrieu-school-demo-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('state', 'readwrite');
    const store = tx.objectStore('state');
    const read = store.get('current');
    read.onsuccess = () => {
      const state = read.result as State;
      const source = state.entries.find((e) => e.id === 'teacher-chat')!;
      for (let i = 0; i < 24; i++) {
        const row = structuredClone(source);
        row.id = `inbox-${i}`;
        row.title = {
          fr: `Conversation ${i} — ${'Un objet très long '.repeat(12)}`,
          en: `Conversation ${i} — ${'A very long subject '.repeat(12)}`,
        };
        row.messages[0].at = `2026-10-${String(i + 1).padStart(2, '0')}T08:00:00.000Z`;
        row.messages[0].text = i === 23 ? 'Latest activity' : 'An older message';
        state.entries.push(row);
      }
      const hidden = structuredClone(source);
      hidden.id = 'hidden-inbox';
      hidden.participants = ['thomas', 'emma'];
      hidden.author = 'thomas';
      hidden.title = { fr: 'Confidentialneedle', en: 'Confidentialneedle' };
      hidden.messages[0].text = 'Confidentialneedle';
      state.entries.push(hidden);
      store.put(state, 'current');
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  const list = page.getByRole('list', { name: 'Conversations', exact: true });
  await expect(list.getByRole('listitem')).toHaveCount(26);
  await expect(list.getByRole('button').first()).toHaveAccessibleName(/^Conversation 23/);
  await expect(list.getByRole('button').first()).toContainText('Latest activity');
  await page
    .getByRole('textbox', { name: 'Rechercher dans mes messages' })
    .fill('Confidentialneedle');
  await expect(list).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Rechercher dans mes messages' }).fill('');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const locale of ['en', 'fr']) {
      await page
        .getByRole('button', { name: locale === 'en' ? 'Switch to English' : 'Passer en français' })
        .click();
      await expect(list.getByRole('listitem')).toHaveCount(26);
      const geometry = await list.evaluate((el) => {
        const rows = [...el.querySelectorAll('button')].map((row) => row.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          maxHeight: Math.max(...rows.map((row) => row.height)),
          aligned: rows.every(
            (row) =>
              Math.abs(row.left - rows[0].left) < 1 && Math.abs(row.width - rows[0].width) < 1,
          ),
        };
      });
      expect(geometry.overflow, `${width}px ${locale}`).toBe(false);
      expect(geometry.aligned).toBe(true);
      expect(geometry.maxHeight).toBeLessThan(160);
    }
  }
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 960 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

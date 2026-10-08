import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const boot = async (page: Page, actor = 'director') => {
  await page.clock.setFixedTime(new Date('2026-10-08T08:00:00Z'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Explorer la démo' }).click();
  await persona(page, actor);
  await page.goto('./#/administration');
};
const persona = async (page: Page, actor: string) => {
  await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption(actor);
  await expect(page.locator('main h1')).toBeVisible();
};
const row = (page: Page, name: string) =>
  page.locator('.admin-table tbody tr').filter({ has: page.getByText(name, { exact: true }) });
const pupils = async (page: Page) =>
  page.getByRole('button', { name: 'Enfants et classes', exact: true }).click();
const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );

test('teacher adds a blank pupil, transfers the same record and loses source-class access', async ({
  page,
}) => {
  await boot(page, 'emma');
  await expect(page.getByRole('button', { name: 'Adultes et accès', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inviter un adulte', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajouter un élève', exact: true }).click();
  await page.getByLabel('Nom de l’élève', { exact: true }).fill('Ari Exemple');
  await page.getByLabel('Date de naissance', { exact: true }).fill('2019-03-12');
  await page.getByLabel('Classe d’inscription').selectOption('ce');
  await expect(page.getByRole('group', { name: 'Responsables légaux vérifiés' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Créer le dossier élève', exact: true }).click();
  await expect(row(page, 'Ari Exemple')).toBeVisible();
  await row(page, 'Ari Exemple').getByRole('button', { name: 'Dossier', exact: true }).click();
  const url = page.url();
  await page.goto('./#/administration');
  await page.getByLabel('Classe de Ari Exemple', { exact: true }).selectOption('cm');
  await page.getByRole('button', { name: 'Confirmer le transfert', exact: true }).click();
  await expect(row(page, 'Ari Exemple')).toHaveCount(0);
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
  await persona(page, 'leonie');
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Ari Exemple', exact: true })).toBeVisible();
});

test('teacher removes from class and director reassigns, archives and restores the record', async ({
  page,
}) => {
  await boot(page, 'emma');
  await row(page, 'Louise Martin')
    .getByRole('button', { name: 'Retirer de la classe', exact: true })
    .click();
  await page.getByLabel('Motif du retrait').fill('Changement de groupe');
  await page.getByRole('button', { name: 'Confirmer le retrait de la classe' }).click();
  await expect(row(page, 'Louise Martin')).toHaveCount(0);
  await persona(page, 'director');
  await page.goto('./#/administration');
  await pupils(page);
  await page.getByLabel('Statut des élèves').selectOption('unassigned');
  await expect(row(page, 'Louise Martin')).toBeVisible();
  await page.getByLabel('Classe de Louise Martin', { exact: true }).selectOption('ce');
  await page.getByRole('button', { name: 'Confirmer le transfert' }).click();
  await expect(row(page, 'Louise Martin')).toHaveCount(0);
  await page.getByLabel('Statut des élèves').selectOption('active');
  await row(page, 'Louise Martin').getByRole('button', { name: 'Archiver', exact: true }).click();
  await page.getByLabel('Motif du retrait').fill('Départ fictif');
  await page.getByRole('button', { name: 'Confirmer le départ et archiver' }).click();
  await expect(row(page, 'Louise Martin')).toHaveCount(0);
  await page.getByLabel('Statut des élèves').selectOption('archived');
  await row(page, 'Louise Martin').getByRole('button', { name: 'Réinscrire', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la réinscription' }).click();
  await page.getByLabel('Statut des élèves').selectOption('active');
  await expect(row(page, 'Louise Martin')).toBeVisible();
});

test('teacher manages only a linked parent mandate in assigned classes', async ({ page }) => {
  await boot(page, 'emma');
  await page.getByRole('button', { name: 'Parents délégués', exact: true }).click();
  await page.getByLabel('Classe du mandat').selectOption('ce');
  expect(
    await page
      .getByLabel('Classe du mandat')
      .locator('option')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value)),
  ).not.toContain('cm');
  await page.getByLabel('Parent de cette classe').selectOption('alice');
  await page.getByLabel('Fin du mandat', { exact: true }).fill('2027-06-30');
  await page.getByRole('button', { name: 'Enregistrer le mandat', exact: true }).click();
  await expect(row(page, 'Alice Martin')).toBeVisible();
  await row(page, 'Alice Martin')
    .getByRole('button', { name: 'Retirer le mandat', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmer le retrait du mandat' }).click();
  await expect(row(page, 'Alice Martin')).toHaveCount(0);
  await persona(page, 'alice');
  await page.goto('./#/children/c1');
  await expect(page.getByRole('heading', { name: 'Louise Martin', exact: true })).toBeVisible();
  await page.goto('./#/administration');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
});

test('pupil photos persist offline, follow profile access, reject invalid files and can be removed', async ({
  page,
  context,
  browserName,
}) => {
  await boot(page, 'emma');
  await row(page, 'Louise Martin').getByRole('button', { name: 'Modifier', exact: true }).click();
  const upload = page.getByLabel('Photo de profil', { exact: true });
  await upload.setInputFiles({
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a valid image'),
  });
  await expect(page.getByRole('status')).toContainText('La photo n’a pas été enregistrée');
  await upload.setInputFiles('public/sample-image.png');
  await expect(
    page.getByRole('dialog').getByRole('img', { name: 'Photo de Louise Martin' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    row(page, 'Louise Martin').getByRole('img', { name: 'Photo de Louise Martin' }),
  ).toBeVisible();
  await persona(page, 'alice');
  await page.goto('./#/children/c1');
  await expect(page.getByRole('img', { name: 'Photo de Louise Martin' })).toBeVisible();
  await expect(page.getByLabel('Photo de profil', { exact: true })).toHaveCount(0);
  if (browserName === 'chromium') {
    // An earlier build saved raw Blobs. Confirm that the same repository still reads them.
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('peyrieu-school-demo-v1', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['state', 'files'], 'readwrite');
        const request = tx.objectStore('state').get('current');
        request.onsuccess = () => {
          const id = request.result.children.find((c: { id: string }) => c.id === 'c1').photoId;
          const file = tx.objectStore('files').get(id);
          file.onsuccess = () =>
            tx
              .objectStore('files')
              .put(new Blob([file.result.bytes], { type: file.result.type }), id);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
  }
  await page.reload();
  await expect(page.getByRole('img', { name: 'Photo de Louise Martin' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  if (browserName === 'webkit') {
    // This runner reports an internal WebKit error on offline reload. Exercise local navigation;
    // fresh offline navigation remains covered by Chromium and Firefox, not claimed for WebKit.
    await page.evaluate(() => {
      location.hash = '#/children';
    });
    await page.getByRole('button', { name: 'Ouvrir le profil', exact: true }).first().click();
  } else await page.reload();
  await expect(page.getByRole('img', { name: 'Photo de Louise Martin' })).toBeVisible();
  await context.setOffline(false);
  await persona(page, 'ines');
  await page.goto('./#/children/c1');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Photo de Louise Martin' })).toHaveCount(0);
  await persona(page, 'emma');
  await page.goto('./#/children/c1');
  await page.getByRole('button', { name: 'Retirer la photo', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Photo de Louise Martin' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('img', { name: 'Photo de Louise Martin' })).toHaveCount(0);
});

test('direction manages staff photos; staff can change their own; parents have no photo controls', async ({
  page,
}) => {
  await boot(page);
  await row(page, 'Emma Laurent').getByRole('button', { name: 'Gérer', exact: true }).click();
  await page
    .getByLabel('Photo de profil', { exact: true })
    .setInputFiles('public/sample-image.png');
  await expect(
    page.getByRole('dialog').getByRole('img', { name: 'Photo de Emma Laurent' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await row(page, 'Alice Martin').getByRole('button', { name: 'Gérer', exact: true }).click();
  await expect(page.getByLabel('Photo de profil', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await persona(page, 'emma');
  await page.goto('./#/settings');
  await expect(
    page.locator('.persona-picker').getByRole('img', { name: 'Photo de Emma Laurent' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retirer la photo', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Photo de Emma Laurent' })).toHaveCount(0);
  await persona(page, 'nora');
  await page.goto('./#/settings');
  await page
    .getByLabel('Photo de profil', { exact: true })
    .setInputFiles('public/sample-image.png');
  await expect(
    page.locator('.persona-picker').getByRole('img', { name: 'Photo de Nora Dubois' }),
  ).toBeVisible();
  await persona(page, 'alice');
  await page.goto('./#/settings');
  await expect(page.getByLabel('Photo de profil', { exact: true })).toHaveCount(0);
});

for (const width of [320, 1440])
  test(`administration, editors and photo controls reflow accessibly at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await boot(page);
    await noOverflow(page);
    await page.screenshot({ path: `test-results/admin-adults-${width}.png`, fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await row(page, 'Emma Laurent').getByRole('button', { name: 'Gérer', exact: true }).click();
    await noOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/admin-editor-${width}.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await pupils(page);
    await noOverflow(page);
    await page.screenshot({ path: `test-results/admin-pupils-${width}.png`, fullPage: true });
    await row(page, 'Louise Martin').getByRole('button', { name: 'Modifier', exact: true }).click();
    await noOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Parents délégués', exact: true }).click();
    await noOverflow(page);
    await page.getByRole('button', { name: 'Droits et recommandations', exact: true }).click();
    await noOverflow(page);
  });

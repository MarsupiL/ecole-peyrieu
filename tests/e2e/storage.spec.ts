import { expect, test, type Page } from '@playwright/test';

const boot = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('peyrieu.welcome', '1');
    localStorage.setItem('peyrieu.actor', 'alice');
  });
  await page.goto('./#/settings');
  await expect(
    page.getByRole('heading', { name: 'Un espace à votre rythme', exact: true }),
  ).toBeVisible();
};
const stored = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('peyrieu-school-demo-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ revision: number; adults: { id: string; contact: string }[] }>(
        (resolve, reject) => {
          const request = db.transaction('state').objectStore('state').get('current');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
    } finally {
      db.close();
    }
  });

test('a stale second tab cannot overwrite saved preferences and retains unsaved input', async ({
  page,
  context,
}) => {
  await boot(page);
  const second = await context.newPage();
  await second.goto('./#/settings');
  await expect(
    second.getByRole('heading', { name: 'Un espace à votre rythme', exact: true }),
  ).toBeVisible();
  const firstInput = page.locator('input[type=email]');
  await firstInput.fill('first@example.invalid');
  await firstInput.press('Tab');
  await expect(page.getByRole('status')).toContainText('Enregistré dans ce navigateur');
  const before = await stored(page);
  const secondInput = second.locator('input[type=email]');
  await secondInput.fill('second@example.invalid');
  await secondInput.press('Tab');
  await expect(second.getByRole('status')).toContainText('Une autre fenêtre');
  await expect(secondInput).toHaveValue('second@example.invalid');
  expect(await stored(page)).toEqual(before);
  await second.reload();
  await expect(second.locator('input[type=email]')).toHaveValue('first@example.invalid');
  await second.close();
});

test('corrupt storage shows recovery without resetting records or failing inside React', async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('peyrieu-school-demo-v1');
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ schema: 1, marker: 'preserve this record' }, 'current');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading')).toContainText('Vos données sont conservées');
  await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible();
  expect(await stored(page)).toEqual({ schema: 1, marker: 'preserve this record' });
  expect(errors).toEqual([]);
});

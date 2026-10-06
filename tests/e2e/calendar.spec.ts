import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import type { State } from '../../src/domain/types';

const boot = async (page: Page) => {
  await page.clock.setFixedTime(new Date('2026-10-06T08:00:00Z'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Explorer la démo' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Alice,' })).toBeVisible();
  await page.goto('./#/calendar');
};

const populate = async (page: Page) => {
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
      const source = s.entries.find((e) => e.id === 'meeting')!;
      s.entries.push(
        {
          ...structuredClone(source),
          id: 'summer',
          title: { fr: 'Rencontre de fin d’année', en: 'End-of-year gathering' },
          start: '2027-07-15T08:00:00Z',
          end: '2027-07-15T09:00:00Z',
        },
        {
          ...structuredClone(source),
          id: 'weekly',
          title: { fr: 'Atelier hebdomadaire', en: 'Weekly workshop' },
          start: '2026-10-19T08:00:00Z',
          end: '2026-10-19T09:00:00Z',
          recurrence: 'weekly',
        },
        {
          ...structuredClone(source),
          id: 'range',
          title: { fr: 'Projet sur plusieurs jours', en: 'Multi-day project' },
          start: '2026-10-31',
          end: '2026-11-03',
          allDay: true,
        },
        {
          ...structuredClone(source),
          id: 'hidden',
          title: { fr: 'Réunion confidentielle', en: 'Confidential meeting' },
          start: '2027-04-06',
          end: '2027-04-07',
          allDay: true,
          audience: { type: 'class', ids: ['cm'] },
        },
      );
      s.clock = '2026-10-20T08:00:00Z';
      store.put(s, 'current');
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
};

test('the school year opens with highlighted dates, expandable details and month/list navigation', async ({
  page,
}) => {
  await boot(page);
  await expect(page.locator('.calendar-month')).toHaveCount(12);
  await expect(page.locator('.calendar-month').first()).toHaveAccessibleName('septembre 2026');
  await expect(page.locator('.calendar-month').last()).toHaveAccessibleName('août 2027');
  await expect(page.getByRole('button', { name: 'Année', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const date = page.getByRole('button', { name: /12 octobre 2026 · 1 événement/ });
  await date.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('lundi 12 octobre 2026');
  await expect(
    dialog.getByRole('heading', { name: 'Rencontre des familles', exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText('17:00');
  await page.keyboard.press('Escape');
  await expect(date).toBeFocused();
  await date.click();
  await dialog.getByRole('button', { name: 'Ouvrir l’événement', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Rencontre des familles', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Louise Martin', { exact: true })).toBeVisible();
  await page.goto('./#/calendar');
  await page.getByRole('button', { name: 'Afficher octobre 2026', exact: true }).click();
  await expect(page.locator('.calendar-month')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Mois', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Mois suivant', exact: true }).click();
  await expect(page.locator('.calendar-month')).toHaveAccessibleName('novembre 2026');
  await page.getByRole('button', { name: 'Aujourd’hui', exact: true }).click();
  await expect(page.locator('.calendar-month')).toHaveAccessibleName('octobre 2026');
  await expect(page.locator('[aria-current="date"]')).toHaveAccessibleName('mardi 6 octobre 2026');
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Rencontre des familles', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Année scolaire suivante', exact: true }).click();
  await expect(page.getByText('Aucun événement pour cette période et ces filtres.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exporter', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Année scolaire précédente', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Rencontre des familles', exact: true }),
  ).toBeVisible();
});

test('year highlights include summer, recurrence, shared dates and exclusive ranges with private filters and valid export', async ({
  page,
}) => {
  await boot(page);
  await populate(page);
  await page.getByRole('button', { name: /15 juillet 2027 · 1 événement/ }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Rencontre de fin d’année' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /2 novembre 2026 · 2 événements/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Atelier hebdomadaire' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Projet sur plusieurs jours' })).toBeVisible();
  await expect(dialog).toContainText('10:00');
  await expect(dialog).toContainText('31 oct. 2026 – 2 nov. 2026');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /3 novembre 2026 ·/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /9 novembre 2026 · 1 événement/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /16 novembre 2026 ·/ })).toHaveCount(0);
  await page.getByLabel('Filtrer les événements').selectOption('upcoming');
  await expect(page.getByRole('button', { name: /19 octobre 2026 ·/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /26 octobre 2026 · 1 événement/ })).toBeVisible();
  await page.getByLabel('Filtrer les événements').selectOption('cancelled');
  const cancelled = page.getByRole('button', { name: /11 octobre 2026 · 1 événement · Annulé/ });
  await expect(cancelled).toHaveClass(/month-day-cancelled/);
  await cancelled.click();
  await expect(dialog.getByText('Annulé', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Filtrer les événements').selectOption('all');
  await page.getByLabel('Rechercher dans l’agenda').fill('confidentielle');
  await expect(page.locator('.month-day-event')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exporter', exact: true })).toBeDisabled();
  await page.getByLabel('Rechercher dans l’agenda').fill('  hebdomadaire ');
  await expect(page.locator('.month-day-event')).toHaveCount(4);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const downloaded = await downloading;
  const text = await readFile((await downloaded.path())!, 'utf8');
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(text).toContain('RRULE:FREQ=WEEKLY;COUNT=4');
  expect(text).not.toContain('confidentielle');
});

test('calendar views remain responsive and accessible in French with enlarged text', async ({
  page,
}) => {
  await boot(page);
  await populate(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['year', 'month', 'list']) {
      const names = { year: 'Année', month: 'Mois', list: 'Liste' };
      await page
        .getByRole('button', { name: names[view as keyof typeof names], exact: true })
        .click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width}px ${view}`,
      ).toBe(true);
      if (view !== 'list') {
        const days = await page.locator('.month-day-event').evaluateAll((buttons) =>
          buttons.map((b) => ({
            width: b.getBoundingClientRect().width,
            height: b.getBoundingClientRect().height,
          })),
        );
        expect(days.every((b) => b.width >= 24 && b.height >= 24)).toBe(true);
      }
      if ([390, 1440].includes(width) && view !== 'list')
        await page.screenshot({
          path: `test-results/design/calendar-${view}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.getByRole('button', { name: 'Année', exact: true }).click();
  let scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole('button', { name: /2 novembre 2026 · 2 événements/ }).click();
  scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 1000 });
  const panel = await page.getByRole('dialog').boundingBox();
  expect(panel && panel.x >= 0 && panel.x + panel.width <= 391).toBe(true);
  await page.screenshot({ path: 'test-results/design/calendar-panel-390.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  for (const view of ['Année', 'Mois', 'Liste']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `200% ${view}`,
    ).toBe(true);
  }
});

import { test, expect, type Page } from '@playwright/test';

const routes = [
  'home',
  'news',
  'messages',
  'calendar',
  'forms',
  'children',
  'progress',
  'reservations',
  'surveys',
  'representatives',
  'settings',
  'notifications',
  'help',
];
const boot = async (page: Page) => {
  await page.clock.setFixedTime(new Date('2026-10-06T08:00:00Z'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Explorer la démo · Explore demo' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Alice,' })).toBeVisible();
};

// Inspect actual rendered text and geometry, including native selects whose
// scrollWidth alone does not reveal a clipped selected label.
const layoutIssues = (page: Page) =>
  page.evaluate(() => {
    const visible = (el: Element) =>
      el.getBoundingClientRect().width > 0 &&
      getComputedStyle(el).visibility !== 'hidden' &&
      !el.closest('[inert]');
    const context = document.createElement('canvas').getContext('2d')!;
    const issues: string[] = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('Page overflows');
    const root = document.querySelector('dialog[open]') ?? document;
    root.querySelectorAll('select').forEach((el) => {
      if (!visible(el)) return;
      const wrapped = el.closest('.select-control')?.querySelector('.select-value');
      if (wrapped) {
        if (wrapped.scrollWidth > wrapped.clientWidth + 1)
          issues.push(`Clipped wrapped select: ${wrapped.textContent}`);
        if (wrapped.getBoundingClientRect().height > el.getBoundingClientRect().height + 1)
          issues.push('Wrapped value extends beyond select border');
        return;
      }
      const style = getComputedStyle(el);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const label = el.selectedOptions[0]?.textContent ?? '';
      const required =
        context.measureText(label).width +
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        2;
      if (required > el.getBoundingClientRect().width + 2) issues.push(`Clipped select: ${label}`);
    });
    root
      .querySelectorAll(
        'main button,main input,main textarea,dialog button,dialog input,dialog textarea',
      )
      .forEach((el) => {
        if (!visible(el) || el.closest('.table-wrap')) return;
        const box = el.getBoundingClientRect();
        if (box.left < -1 || box.right > innerWidth + 1)
          issues.push(`Control outside viewport: ${el.tagName}`);
      });
    root.querySelectorAll('.calendar-date').forEach((el) => {
      const month = el.querySelector('.calendar-month')!.getBoundingClientRect();
      const day = el.querySelector('.calendar-day')!.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      if (day.top < month.bottom || day.bottom > box.bottom || month.top < box.top)
        issues.push('Date badge is not stacked inside its border');
    });
    return issues;
  });

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`all role modules fit at ${width}px in French and English`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 960 });
    await boot(page);
    for (const actor of ['alice', 'emma', 'director', 'nora', 'ines']) {
      await page
        .getByRole('combobox', { name: /Profil de démonstration|Demo persona/ })
        .selectOption(actor);
      for (const locale of ['fr', 'en']) {
        if ((await page.locator('html').getAttribute('lang')) !== locale)
          await page
            .getByRole('button', {
              name: locale === 'fr' ? 'Passer en français' : 'Switch to English',
            })
            .click();
        for (const route of [...routes, ...(actor === 'director' ? ['administration'] : [])]) {
          await page.goto(`./#/${route}`);
          await expect(page.locator('main h1')).toBeVisible();
          expect(await layoutIssues(page), `${actor} ${locale} ${route} at ${width}px`).toEqual([]);
        }
      }
    }
  });
}

for (const width of [390, 1024]) {
  test(`forms, dates and editor dialogs fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page);
    for (const route of [
      'form/annual',
      'children/c1',
      'event/nature',
      'poll/survey',
      'conversation/teacher-chat',
    ]) {
      await page.goto(`./#/${route}`);
      expect(await layoutIssues(page), route).toEqual([]);
    }
    await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption('emma');
    for (const [route, action] of [
      ['calendar', 'Créer un événement'],
      ['forms', 'Créer une démarche'],
      ['news', 'Nouvelle publication'],
    ]) {
      await page.goto(`./#/${route}`);
      await page.getByRole('button', { name: action, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await layoutIssues(page), `${route} editor`).toEqual([]);
      await page.screenshot({
        path: `test-results/design/editor-${route}-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press('Escape');
    }
  });
}

test('date badges use the same Paris calendar day and month near midnight', async ({ page }) => {
  await boot(page);
  await page.getByRole('combobox', { name: 'Profil de démonstration' }).selectOption('emma');
  await page.goto('./#/calendar');
  await page.getByRole('button', { name: 'Créer un événement', exact: true }).click();
  await page.getByLabel('Titre en français *', { exact: true }).fill('Test du premier novembre');
  await page
    .getByLabel('Texte en français *', { exact: true })
    .fill('Événement fictif après minuit à Paris.');
  await page.getByLabel('Début (heure de Paris)', { exact: true }).fill('2026-11-01T00:30');
  await page.getByLabel('Fin (heure de Paris)', { exact: true }).fill('2026-11-01T01:30');
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('./#/calendar');
  const event = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Test du premier novembre', exact: true }) });
  await expect(event.locator('.calendar-day')).toHaveText('1');
  await expect(event.locator('.calendar-month')).toHaveText('nov');
  await expect(event.locator('time')).toHaveAttribute('aria-label', '1 nov. 2026');
});

test('key layouts reflow at 200 percent text size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await boot(page);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  for (const route of ['home', 'settings', 'calendar', 'reservations', 'form/annual']) {
    await page.goto(`./#/${route}`);
    expect(await layoutIssues(page), route).toEqual([]);
  }
});

test('form dropdowns preserve focus, native selection and translated visible values', async ({
  page,
}) => {
  await boot(page);
  await page.goto('./#/settings');
  const reminder = page.getByRole('combobox', { name: 'Rappel des événements', exact: true });
  await reminder.focus();
  await expect(reminder).toBeFocused();
  await reminder.selectOption('1');
  await expect(reminder).toHaveValue('1');
  await expect(reminder.locator('..').locator('.select-value')).toHaveText('1 heure avant');
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  const translated = page.getByRole('combobox', { name: 'Event reminders', exact: true });
  await expect(translated).toHaveValue('1');
  await expect(translated.locator('..').locator('.select-value')).toHaveText('1 hour before');
});

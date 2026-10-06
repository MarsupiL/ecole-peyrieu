import { test, expect, type Locator, type Page } from '@playwright/test';

const boot = async (page: Page) => {
  await page.clock.setFixedTime(new Date('2026-10-06T08:00:00Z'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Explorer la démo' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Alice,' })).toBeVisible();
};

const outline = (select: Locator) =>
  select.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });

test('pointer-selected dropdowns keep native focus without a ring and keyboard navigation restores it', async ({
  page,
}) => {
  await boot(page);
  for (const [route, label, value] of [
    ['progress', 'Domaine', 'reading'],
    ['settings', 'Rappel des événements', '1'],
    ['calendar', 'Filtrer les événements', 'upcoming'],
  ]) {
    await page.goto(`./#/${route}`);
    const select = page.getByRole('combobox', { name: label, exact: true });
    await select.click();
    await select.selectOption(value);
    await expect(select).toHaveValue(value);
    await expect(select).toBeFocused();
    expect((await outline(select)).style, `${route} pointer selection`).toBe('none');
    // selectOption updates the native value but does not close every platform's picker.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(select).toBeFocused();
    expect(await outline(select), `${route} keyboard return`).toEqual({
      style: 'solid',
      width: '2px',
      color: 'rgb(19, 117, 140)',
    });
    await select.selectOption(value);
    expect((await outline(select)).style).toBe('solid');
    // Clicking a control already focused by the keyboard switches back to pointer styling.
    await select.click();
    await select.selectOption(value);
    expect((await outline(select)).style).toBe('none');
  }
});

test('label activation, touch selection and subsequent keyboard focus retain the correct indicator', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await boot(page);
    await page.goto('./#/settings');
    const reminder = page.getByRole('combobox', { name: 'Rappel des événements', exact: true });
    await page
      .locator('label')
      .filter({ hasText: /^Rappel des événements$/ })
      .click();
    await reminder.selectOption('0');
    await expect(reminder).toHaveValue('0');
    expect((await outline(reminder)).style).toBe('none');
    await page.keyboard.press('Escape');
    await page.getByLabel('Fin du silence', { exact: true }).focus();
    await expect(reminder).not.toHaveAttribute('data-pointer-focus', 'true');
    await reminder.tap();
    await reminder.selectOption('24');
    await expect(reminder).toHaveValue('24');
    expect((await outline(reminder)).style).toBe('none');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(reminder).toBeFocused();
    expect((await outline(reminder)).style).toBe('solid');
    await expect(reminder).toHaveValue('24');
  } finally {
    await context.close();
  }
});

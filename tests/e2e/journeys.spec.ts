import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const boot = async (page: Page) => {
  await page.clock.setFixedTime(new Date('2026-10-06T08:00:00Z'));
  await page.goto('./');
  const welcome = page.getByRole('button', { name: 'Explorer la démo' });
  await welcome.click();
  await expect(page.getByRole('heading', { name: 'Bonjour Alice,' })).toBeVisible();
};
const persona = async (page: Page, id: string) => {
  await page
    .getByRole('combobox', { name: /Profil de démonstration|Demo persona/ })
    .selectOption(id);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};
const route = async (page: Page, path: string) => {
  await page.goto(`./#/${path}`);
};
test('shared form submission, persistence, co-guardian restrictions, staff review and export', async ({
  page,
}) => {
  await boot(page);
  await route(page, 'form/outing');
  await page.getByLabel('Participation à la sortie *').selectOption('allowed');
  await page.getByLabel('J’ai vérifié ces réponses fictives').check();
  await page.getByRole('button', { name: 'Confirmer et transmettre' }).click();
  await expect(page.getByText('Transmis', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Reçu PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await page.reload();
  await expect(page.getByText('Transmis', { exact: true })).toBeVisible();
  await persona(page, 'thomas');
  await route(page, 'form/outing');
  await expect(
    page.getByText('Cette réponse appartient à l’autre responsable.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier ma réponse' })).toHaveCount(0);
  await persona(page, 'emma');
  await route(page, 'form/outing');
  await page.getByRole('button', { name: 'Marquer vérifié' }).click();
  await expect(page.locator('.badge-reviewed').first()).toBeVisible();
});
test('private reply stays private; service inbox is shared only by the appropriate team', async ({
  page,
}) => {
  await boot(page);
  await route(page, 'post/welcome');
  await page.getByRole('button', { name: 'Répondre en privé' }).click();
  await page.getByLabel('Message', { exact: true }).fill('Un message de test privé.');
  await page.getByRole('button', { name: 'Envoyer dans la démo' }).click();
  await expect(page.getByRole('heading', { name: 'Gardons le contact' })).toBeVisible();
  await persona(page, 'thomas');
  await route(page, 'conversation/teacher-chat');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
  await persona(page, 'nora');
  await route(page, 'conversation/team-chat');
  await page.getByLabel('Personne en charge').selectOption('nora');
  await page.getByLabel('Votre message').fill('Réponse de Nora.');
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await persona(page, 'sam');
  await route(page, 'conversation/team-chat');
  await expect(page.getByText('Réponse de Nora.')).toBeVisible();
  await persona(page, 'bus');
  await route(page, 'conversation/team-chat');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
});
test('draft evaluations, independent acknowledgements and known-ID denials', async ({ page }) => {
  await boot(page);
  await route(page, 'evaluation/draft-report');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
  await route(page, 'evaluation/other-report');
  await expect(page.getByText('Observation fictive réservée')).toHaveCount(0);
  await persona(page, 'emma');
  await route(page, 'evaluation/draft-report');
  await page.getByRole('button', { name: 'Publier directement' }).click();
  await persona(page, 'alice');
  await route(page, 'evaluation/draft-report');
  await expect(
    page.getByRole('heading', { name: 'Premiers repères en mathématiques' }),
  ).toBeVisible();
  await route(page, 'evaluation/report');
  await page.getByRole('button', { name: 'Je confirme avoir pris connaissance' }).click();
  await persona(page, 'thomas');
  await route(page, 'evaluation/report');
  await expect(page.getByText('En attente', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Je confirme avoir pris connaissance' }).click();
  await persona(page, 'emma');
  await route(page, 'evaluation/report');
  await expect(page.getByText(/Alice Martin · Ouvert · Lecture confirmée/)).toBeVisible();
  await expect(page.getByText(/Thomas Martin · Ouvert · Lecture confirmée/)).toBeVisible();
});
test('poll response revisions and reviewed summaries', async ({ page }) => {
  await boot(page);
  await route(page, 'poll/survey');
  await page.getByLabel('Jardinage', { exact: true }).check();
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByRole('button', { name: 'Modifier ma réponse' })).toBeVisible();
  await page.getByLabel('Lecture et histoires', { exact: true }).check();
  await page.getByRole('button', { name: 'Modifier ma réponse' }).click();
  await persona(page, 'director');
  await route(page, 'poll/survey');
  await expect(page.getByText('1 réponses', { exact: true })).toBeVisible();
  await page.getByLabel('Synthèse à publier').fill('Un atelier lecture sera proposé.');
  await page.getByRole('button', { name: 'Relire avant publication' }).click();
  await page.getByRole('button', { name: 'Publier la synthèse' }).click();
  await persona(page, 'alice');
  await route(page, 'poll/survey');
  await expect(page.getByText('Un atelier lecture sera proposé.')).toBeVisible();
});
test('full French navigation has no runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  for (const actor of ['alice', 'emma', 'director', 'nora', 'ines']) {
    await persona(page, actor);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    for (const path of [
      'home',
      'news',
      'messages',
      'calendar',
      'forms',
      'children',
      'progress',
      'surveys',
      'reservations',
      'representatives',
      'requests',
      'notifications',
      'settings',
      'help',
      ...(actor === 'director' ? ['administration'] : []),
    ]) {
      await route(page, path);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Loading module');
    }
  }
  expect(errors).toEqual([]);
});
test('responsive home and keyboard-oriented accessibility', async ({ page }) => {
  await boot(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  const desktop = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    desktop.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Les enfants', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Les enfants', exact: true }).click();
  await expect(page.locator('main h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('production service worker works offline at the project subpath', async ({
  page,
  context,
}) => {
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bonjour Alice,' })).toBeVisible();
  await route(page, 'form/outing');
  await page.getByLabel('Participation à la sortie *').selectOption('refused');
  await page.getByLabel('J’ai vérifié ces réponses fictives').check();
  await page.getByRole('button', { name: 'Confirmer et transmettre' }).click();
  await expect(page.getByText('Transmis', { exact: true })).toBeVisible();
  await context.setOffline(false);
});
test('form editor handles conditional fields and recipient preview', async ({ page }) => {
  await boot(page);
  await persona(page, 'emma');
  await route(page, 'forms');
  await page.getByRole('button', { name: 'Créer une démarche' }).click();
  await page.getByLabel('Titre *', { exact: true }).fill('Dossier test');
  await expect(page.getByLabel(/anglais/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Prévisualiser' }).click();
  await expect(page.getByRole('heading', { name: 'Dossier test' })).toBeVisible();
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Dossier test');
  await persona(page, 'alice');
  await route(page, 'forms');
  await expect(page.getByRole('button', { name: 'Dossier test' })).toBeVisible();
});
test('reset removes local edits, feedback and attachments', async ({ page }) => {
  await boot(page);
  await route(page, 'help');
  await page.getByLabel('Ce qui aide, ce qui manque').fill('Retour fictif de test.');
  await page.getByRole('button', { name: 'Enregistrer mon retour ici' }).click();
  await expect(page.getByRole('button', { name: 'Exporter mes retours (1)' })).toBeVisible();
  await route(page, 'settings');
  await page.getByRole('button', { name: 'Réinitialiser cette démo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la réinitialisation' }).click();
  await page.getByRole('button', { name: 'Explorer la démo' }).click();
  await route(page, 'help');
  await expect(page.getByRole('button', { name: 'Exporter mes retours (0)' })).toBeVisible();
});
test('photo withdrawal removes image and known file route; restricted evidence stays restricted', async ({
  page,
}) => {
  await boot(page);
  await route(page, 'post/welcome');
  await expect(page.getByAltText('Illustration fictive de la publication')).toBeVisible();
  await route(page, 'children/c1');
  await page
    .getByRole('combobox', { name: 'Fil privé de classe · Alice Martin' })
    .selectOption('withdrawn');
  await expect(page.getByRole('status')).toContainText('Enregistré dans ce navigateur.');
  await route(page, 'post/welcome');
  await expect(page.getByAltText('Illustration fictive de la publication')).toHaveCount(0);
  await route(page, 'file/sample-photo');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
  await persona(page, 'emma');
  await route(page, 'file/sample-evidence');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
  await persona(page, 'director');
  await route(page, 'file/sample-evidence');
  await expect(page.getByRole('heading', { name: 'justificatif-fictif.pdf' })).toBeVisible();
});
test('legacy upload, staff reopen and PDF receipt preserve the supplied filename', async ({
  page,
}) => {
  await boot(page);
  await persona(page, 'director');
  await route(page, 'form/insurance');
  await page.getByRole('button', { name: 'Réouvrir avec un nouveau délai' }).click();
  await page.getByLabel('Motif de réouverture').fill('Réouverture fictive pour essai.');
  await page.getByRole('button', { name: 'Réouvrir', exact: true }).click();
  await persona(page, 'alice');
  await route(page, 'form/insurance');
  await page.locator('input[type=file]').setInputFiles('public/sample-evidence.pdf');
  await expect(page.getByRole('button', { name: /sample-evidence.pdf/ })).toBeVisible();
  await page.getByLabel('J’ai vérifié ces réponses fictives').check();
  await page.getByRole('button', { name: 'Confirmer et transmettre' }).click();
  await expect(page.getByText('Transmis', { exact: true })).toBeVisible();
  const receipt = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Reçu PDF' }).click();
  await (await receipt).saveAs('test-results/form-receipt-fr.pdf');
  await persona(page, 'director');
  await route(page, 'form/insurance');
  await expect(page.getByRole('button', { name: /sample-evidence.pdf/ })).toBeVisible();
});
test('absence teams acknowledge separately and collection needs explicit confirmation', async ({
  page,
}) => {
  await boot(page);
  await persona(page, 'nora');
  await route(page, 'request/absence');
  await page.getByRole('button', { name: 'Accuser réception pour cette équipe' }).click();
  await expect(page.locator('.badge-completed').first()).toBeVisible();
  await route(page, 'request/collection');
  await expect(page.locator('.badge-pending').first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer le départ' }).click();
  await expect(page.locator('.badge-confirmed').first()).toBeVisible();
  await persona(page, 'alice');
  await route(page, 'request/collection');
  await expect(page.locator('.badge-confirmed').first()).toBeVisible();
  await route(page, 'reservations');
  await expect(page.getByText('Louise Martin · Cantine', { exact: true })).toBeVisible();
});
test('director invitation acceptance and validated CSV import', async ({ page }) => {
  await boot(page);
  await persona(page, 'director');
  await route(page, 'administration');
  await page.getByRole('button', { name: 'Inviter un adulte' }).click();
  await page.getByLabel('Nom fictif').fill('Parent Exemple');
  await page.getByLabel('Lien à un enfant').selectOption('c1');
  await page.getByRole('button', { name: 'Créer l’invitation locale' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Parent Exemple' });
  await row.getByRole('button', { name: 'Voir l’invitation' }).click();
  await page.getByRole('button', { name: 'Simuler l’acceptation' }).click();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  await page.getByRole('button', { name: 'Valider et prévisualiser' }).click();
  await expect(page.getByRole('cell', { name: 'Valide', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Appliquer l’import local' }).click();
  await page.getByRole('button', { name: 'Enfants et classes', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Éloi Exemple' })).toBeVisible();
});
test('form and editor accessibility, mobile details and 200% text zoom', async ({ page }) => {
  await boot(page);
  await route(page, 'form/annual');
  let result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await persona(page, 'emma');
  await route(page, 'forms');
  await page.getByRole('button', { name: 'Créer une démarche' }).click();
  result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await persona(page, 'alice');
  for (const path of [
    'form/annual',
    'children/c1',
    'poll/survey',
    'calendar',
    'reservations',
    'settings',
  ]) {
    await route(page, path);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  await route(page, 'home');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/home-200-percent.png', fullPage: true });
});

test('preference controls retain selected values and class reassignment takes effect', async ({
  page,
}) => {
  await boot(page);
  await route(page, 'settings');
  await page.getByLabel('Rappel des événements', { exact: true }).selectOption('1');
  await expect(page.getByLabel('Rappel des événements', { exact: true })).toHaveValue('1');
  await page.getByLabel('Rappels de démarches et consultations à J−3 et J−1').click();
  await expect(
    page.getByLabel('Rappels de démarches et consultations à J−3 et J−1'),
  ).not.toBeChecked();
  await page.reload();
  await expect(page.getByLabel('Rappel des événements', { exact: true })).toHaveValue('1');
  await expect(
    page.getByLabel('Rappels de démarches et consultations à J−3 et J−1'),
  ).not.toBeChecked();
  await persona(page, 'director');
  await route(page, 'administration');
  await page.getByRole('button', { name: 'Enfants et classes', exact: true }).click();
  await page.getByLabel('Classe de Louise Martin', { exact: true }).selectOption('cm');
  await page.getByRole('button', { name: 'Confirmer le transfert', exact: true }).click();
  await expect(page.getByLabel('Classe de Louise Martin', { exact: true })).toHaveValue('cm');
  await persona(page, 'alice');
  await route(page, 'post/welcome');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
});

test('calendar RSVP, volunteer, edit, cancellation and subscription simulation', async ({
  page,
}) => {
  await boot(page);
  await route(page, 'event/meeting');
  await page.getByLabel('Louise Martin', { exact: true }).selectOption('yes');
  await expect(page.getByLabel('Louise Martin', { exact: true })).toHaveValue('yes');
  await page.getByRole('button', { name: 'Je propose mon aide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retirer mon inscription' })).toBeVisible();
  await persona(page, 'director');
  await route(page, 'event/meeting');
  await expect(page.getByText('Louise Martin · Oui', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Titre *', { exact: true }).fill('Rencontre déplacée · test');
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Rencontre déplacée · test', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Annuler cet événement', exact: true }).click();
  await expect(page.locator('.badge-cancelled')).toBeVisible();
  const file = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ajouter à mon calendrier' }).click();
  expect((await file).suggestedFilename()).toMatch(/\.ics$/);
  await route(page, 'calendar');
  await page.getByRole('button', { name: 'S’abonner', exact: true }).click();
  await page.getByRole('button', { name: 'Créer un jeton fictif' }).click();
  await expect(page.locator('pre')).toContainText('DEMO-ONLY:');
  await page.getByRole('button', { name: 'Révoquer', exact: true }).click();
  await expect(page.locator('pre')).toHaveText('Aucun jeton actif');
});

test('booking request requires a provider confirmation and separate cancellation confirmation', async ({
  page,
}) => {
  await boot(page);
  await route(page, 'reservations');
  await page.getByLabel('Service', { exact: true }).selectOption('care');
  await page.getByLabel('Date de début', { exact: true }).fill('2027-05-18');
  await page.getByRole('button', { name: 'Vérifier les disponibilités' }).click();
  await page.getByRole('button', { name: 'Confirmer la demande fictive' }).click();
  const booking = page.locator('.mini-card').filter({ hasText: 'Louise Martin · Garderie' });
  await expect(booking.locator('.badge-requested')).toBeVisible();
  await booking.getByRole('button', { name: 'Simuler la confirmation du prestataire' }).click();
  await expect(booking.locator('.badge-confirmed')).toBeVisible();
  await booking.getByRole('button', { name: 'Demander l’annulation' }).click();
  await expect(booking.locator('.badge-cancellationRequested')).toBeVisible();
  await booking.getByRole('button', { name: 'Simuler l’annulation confirmée' }).click();
  await expect(booking.locator('.badge-cancelled')).toBeVisible();
  const receipt = page.waitForEvent('download');
  await booking.getByRole('button', { name: 'Reçu PDF' }).click();
  expect((await receipt).suggestedFilename()).toBe('recu-reservation-fictive.pdf');
});

test('representative escalation shares only a reviewed summary', async ({ page }) => {
  await boot(page);
  await persona(page, 'ines');
  await route(page, 'topic/topic');
  await page.getByRole('button', { name: 'Partager une synthèse avec l’équipe' }).click();
  await page.getByLabel('Destinataire', { exact: true }).selectOption('emma');
  await page
    .getByLabel('Synthèse à partager, sans historique privé', { exact: true })
    .fill('Proposition relue de rencontre fictive.');
  await page.getByLabel('J’ai relu exactement ce qui sera partagé.').check();
  await page.getByRole('button', { name: 'Envoyer dans la démo' }).click();
  await expect(page.getByRole('heading', { name: 'Gardons le contact' })).toBeVisible();
  await persona(page, 'emma');
  await route(page, 'messages');
  await page
    .getByRole('button', { name: 'À propos de Préparons notre rencontre de classe', exact: true })
    .click();
  await expect(
    page
      .locator('.conversation-message')
      .getByText('Proposition relue de rencontre fictive.', { exact: true }),
  ).toBeVisible();
  await route(page, 'topic/topic');
  await expect(page.getByRole('heading', { name: 'Accès indisponible' })).toBeVisible();
});

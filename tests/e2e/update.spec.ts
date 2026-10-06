import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

test('a new production worker waits for user action and preserves a saved draft', async ({
  page,
}) => {
  let version = 1;
  const root = resolve('dist');
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
    '.pdf': 'application/pdf',
    '.ics': 'text/calendar',
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url!, 'http://localhost').pathname;
      if (!pathname.startsWith('/ecole-peyrieu/')) {
        res.writeHead(404).end();
        return;
      }
      const relative = pathname.slice('/ecole-peyrieu/'.length) || 'index.html';
      const file = resolve(root, relative);
      if (!file.startsWith(root + '/')) {
        res.writeHead(403).end();
        return;
      }
      let data: Buffer | string = await readFile(file);
      if (relative === 'sw.js')
        data = data
          .toString()
          .replace(/ecole-peyrieu-[a-f0-9]+/, `ecole-peyrieu-update-test-${version}`);
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server');
  const base = `http://127.0.0.1:${address.port}/ecole-peyrieu/`;
  try {
    await page.goto(base);
    await page.getByRole('button', { name: 'Explorer la démo' }).click();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    // An old-path installation can still use its offline cache during the URL move.
    await page.evaluate(async () => {
      const legacy = await caches.open('peyrieu-demo-legacy');
      await legacy.put('/peyrieu-school-demo/migration-check', new Response('preserved'));
    });
    await page.goto(base + '#/form/outing');
    await page.getByLabel('Participation à la sortie *').selectOption('refused');
    await page.getByRole('button', { name: 'Enregistrer le brouillon', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Enregistré dans ce navigateur.');
    version = 2;
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r?.update();
    });
    await expect(page.getByRole('button', { name: 'Mettre à jour', exact: true })).toBeVisible();
    await expect(page.getByLabel('Participation à la sortie *')).toHaveValue('refused');
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.getByRole('button', { name: 'Mettre à jour', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mettre à jour', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Participation à la sortie *')).toHaveValue('refused');
    await expect
      .poll(() => page.evaluate(async () => (await caches.keys()).sort()))
      .toEqual(['ecole-peyrieu-update-test-2', 'peyrieu-demo-legacy']);
    expect(
      await page.evaluate(async () => {
        const legacy = await caches.open('peyrieu-demo-legacy');
        return (await legacy.match('/peyrieu-school-demo/migration-check'))?.text();
      }),
    ).toBe('preserved');
  } finally {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});

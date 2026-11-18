import { expect, test, type Page } from '@playwright/test';

/** Check the installed service worker and its actual offline cache, never presentation copy. */
async function isOfflineShellReady(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const worker = navigator.serviceWorker.controller ?? registration?.active;
    if (!worker) return false;
    return new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        resolve(false);
      }, 4000);
      channel.port1.onmessage = (event: MessageEvent<{ ready: boolean }>) => {
        window.clearTimeout(timeout);
        channel.port1.close();
        resolve(event.data?.ready === true);
      };
      worker.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
    });
  });
}

/** Assert the authoritative IndexedDB save, independently of invisible autosave UI. */
async function readActiveSave(page: Page): Promise<{ revision: number; gameState: unknown } | null> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('meowdeck-local-v1');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      const row = await new Promise<{ save?: { revision: number; gameState: unknown } } | undefined>((resolve, reject) => {
        const transaction = database.transaction('active', 'readonly');
        const request = transaction.objectStore('active').get('active');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return row?.save ?? null;
    } finally {
      database.close();
    }
  });
}

test('production PWA precaches and resumes a real offline match after reopening', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    let page = await context.newPage();
    await page.goto('/');
    await expect(page.getByTestId('main-menu')).toBeVisible();

    const response = await page.request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      const iconResponse = await page.request.get(icon.src);
      expect(iconResponse.status()).toBe(200);
    }

    await expect.poll(() => isOfflineShellReady(page), { timeout: 90_000, intervals: [500, 1000, 2000] }).toBe(true);
    await expect(page.getByTestId('offline-status')).toHaveCount(0);

    await page.getByTestId('play-now').click();
    await page.getByTestId('select-crazy-eights').click();
    await page.getByTestId('difficulty-easy').click();
    await page.getByTestId('start-match').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();

    await expect.poll(() => readActiveSave(page), { timeout: 10_000 }).not.toBeNull();
    const initial = await readActiveSave(page);
    expect(initial).not.toBeNull();
    const handCount = await page.getByTestId('player-hand').locator('button').count();

    await page.close();
    await context.setOffline(true);

    page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('main-menu')).toBeVisible();
    await expect(page.getByTestId('continue')).toBeVisible();
    await page.getByTestId('continue').click();
    // A newly opened tab has a different sessionStorage owner. If the old
    // tab's 14-second IndexedDB lease is still active, resume requires an
    // explicit takeover rather than silently overwriting another session.
    await expect(page.locator('[data-testid="gameplay-screen"], dialog[open]')).toBeVisible();
    if (await page.getByRole('dialog').isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /take over|เล่นในแท็บนี้/i }).click();
    }
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
    await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(handCount);

    const first = page.getByTestId('player-hand').locator('button[data-playable="true"]').first();
    if (await first.count()) {
      await first.click();
      await page.getByTestId('play-selected').click();
    } else {
      await page.getByTestId('draw-card').click();
    }
    if (await page.getByTestId('suit-S').isVisible().catch(() => false)) {
      await page.getByTestId('suit-S').click();
    }

    await expect.poll(async () => (await readActiveSave(page))?.revision ?? 0, { timeout: 10_000 })
      .toBeGreaterThan(initial!.revision);
    await expect(page.getByTestId('save-status')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('continue')).toBeVisible();
  } finally {
    await context.close();
  }
});

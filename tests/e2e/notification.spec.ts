import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchApp, sendToOverlay } from './helpers/launch';

test('overlay displays injected notification', async () => {
  const app = await launchApp();
  const overlayWin = await app.firstWindow();
  await overlayWin.waitForFunction(() => (document.body as HTMLElement).dataset.overlayReady === 'true');

  await sendToOverlay(app, 'notification', {
    sender: 'テスト送信者',
    body: 'テスト本文',
    appName: 'TestApp',
  });

  await expect(overlayWin.locator('text=TestApp')).toBeVisible({ timeout: 5_000 });
  await expect(overlayWin.locator('text=テスト送信者')).toBeVisible();
  await expect(overlayWin.locator('text=テスト本文')).toBeVisible();

  await app.close();
});

test('overlay hides after display duration', async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-e2e-dur-'));
  fs.writeFileSync(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ displayDuration: 1000 }),
  );

  try {
    const app = await launchApp([], { E2E_USERDATA_PATH: userDataPath });
    const overlayWin = await app.firstWindow();
    await overlayWin.waitForFunction(() => (document.body as HTMLElement).dataset.overlayReady === 'true');

    await sendToOverlay(app, 'notification', {
      sender: '消えるテスト',
      body: '1秒後に消える',
      appName: 'TestApp',
    });

    await expect(overlayWin.locator('text=消えるテスト')).toBeVisible({ timeout: 5_000 });
    await expect(overlayWin.locator('text=消えるテスト')).not.toBeVisible({ timeout: 5_000 });

    await app.close();
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

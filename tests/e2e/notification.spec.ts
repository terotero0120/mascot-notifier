import { expect, test } from '@playwright/test';
import { launchApp, sendToOverlay } from './helpers/launch';

test('overlay displays injected notification', async () => {
  const app = await launchApp();
  const overlayWin = await app.firstWindow();
  await overlayWin.waitForLoadState('domcontentloaded');

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
  const app = await launchApp();
  const overlayWin = await app.firstWindow();
  await overlayWin.waitForLoadState('domcontentloaded');

  await app.evaluate(({ webContents }) => {
    const overlayWC = webContents
      .getAllWebContents()
      .find((wc) => !wc.getURL().includes('#'));
    overlayWC?.send('settings-changed', {
      displayPosition: 'top-right',
      characterFile: 'dance.json',
      displayDuration: 1000,
    });
    overlayWC?.send('notification', {
      sender: '消えるテスト',
      body: '1秒後に消える',
      appName: 'TestApp',
    });
  });

  await expect(overlayWin.locator('text=消えるテスト')).toBeVisible({ timeout: 5_000 });
  await expect(overlayWin.locator('text=消えるテスト')).not.toBeVisible({ timeout: 5_000 });

  await app.close();
});

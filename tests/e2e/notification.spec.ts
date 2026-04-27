import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/launch';

test('overlay displays injected notification', async () => {
  const app = await launchApp();
  const overlayWin = await app.firstWindow();
  await overlayWin.waitForLoadState('domcontentloaded');

  await app.evaluate(({ webContents }) => {
    const allWC = webContents.getAllWebContents();
    const overlayWC = allWC.find((wc) => !wc.getURL().includes('#'));
    overlayWC?.send('notification', {
      sender: 'テスト送信者',
      body: 'テスト本文',
      appName: 'TestApp',
    });
  });

  await expect(overlayWin.locator('text=TestApp')).toBeVisible({ timeout: 10_000 });
  await expect(overlayWin.locator('text=テスト送信者')).toBeVisible();
  await expect(overlayWin.locator('text=テスト本文')).toBeVisible();

  await app.close();
});

test('overlay hides after display duration', async () => {
  const app = await launchApp();
  const overlayWin = await app.firstWindow();
  await overlayWin.waitForLoadState('domcontentloaded');

  // Use a short display duration to keep the test fast
  await app.evaluate(({ webContents }) => {
    const allWC = webContents.getAllWebContents();
    const overlayWC = allWC.find((wc) => !wc.getURL().includes('#'));
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

  await expect(overlayWin.locator('text=消えるテスト')).toBeVisible({ timeout: 10_000 });
  // After display duration (1s) + fade (0.5s), overlay should be gone
  await expect(overlayWin.locator('text=消えるテスト')).not.toBeVisible({ timeout: 5_000 });

  await app.close();
});

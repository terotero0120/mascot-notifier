import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchApp } from './helpers/launch';

const BOTTOM_RIGHT_RADIO = 'input[name="displayPosition"][value="bottom-right"]';

async function findSettingsWindow(app: Awaited<ReturnType<typeof launchApp>>) {
  await app.firstWindow();
  await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBe(2);
  const windows = app.windows();
  await Promise.all(windows.map((win) => win.waitForLoadState('domcontentloaded')));
  const settingsWin = windows.find((w) => w.url().includes('#settings'));
  if (!settingsWin) throw new Error('Settings window not found');
  return settingsWin;
}

test('settings window opens with --open-settings flag', async () => {
  const app = await launchApp(['--open-settings']);
  await findSettingsWindow(app);
  await app.close();
});

test('settings are saved and persisted across restarts', async () => {
  const userDataPath = path.join(os.tmpdir(), `mascot-e2e-persist-${Date.now()}`);
  fs.mkdirSync(userDataPath, { recursive: true });

  try {
    // First launch: change display position and save
    {
      const app = await launchApp(['--open-settings'], { E2E_USERDATA_PATH: userDataPath });
      const settingsWin = await findSettingsWindow(app);

      await settingsWin.click(BOTTOM_RIGHT_RADIO);
      await settingsWin.click('button:has-text("保存")');
      await expect(settingsWin.locator('text=保存しました')).toBeVisible();

      await app.close();
    }

    // Verify settings.json on disk
    const saved = JSON.parse(
      fs.readFileSync(path.join(userDataPath, 'settings.json'), 'utf8'),
    );
    expect(saved.displayPosition).toBe('bottom-right');

    // Second launch: verify persisted value is selected
    {
      const app = await launchApp(['--open-settings'], { E2E_USERDATA_PATH: userDataPath });
      const settingsWin = await findSettingsWindow(app);

      await expect(settingsWin.locator(BOTTOM_RIGHT_RADIO)).toBeChecked();

      await app.close();
    }
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

import { test } from '@playwright/test';
import { launchApp } from './helpers/launch';

test('app launches without crash', async () => {
  const app = await launchApp();
  await app.firstWindow();
  await app.close();
});

test('app exits cleanly', async () => {
  const app = await launchApp();
  await app.firstWindow();
  await app.close();
});

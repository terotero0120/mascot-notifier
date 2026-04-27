import { _electron as electron } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import path from 'node:path';

export async function launchApp(
  extraArgs: string[] = [],
  extraEnv: Record<string, string> = {},
): Promise<ElectronApplication> {
  return electron.launch({
    args: [path.join(__dirname, '../../../out/main/index.js'), ...extraArgs],
    env: { ...process.env, E2E_TEST: 'true', ...extraEnv },
  });
}

export async function sendToOverlay(
  app: ElectronApplication,
  channel: string,
  data: Record<string, unknown>,
): Promise<void> {
  await app.evaluate(
    ({ webContents }, args) => {
      webContents
        .getAllWebContents()
        .find((wc) => !wc.getURL().includes('#'))
        ?.send(args.channel, args.data);
    },
    { channel, data },
  );
}

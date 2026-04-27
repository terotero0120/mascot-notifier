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

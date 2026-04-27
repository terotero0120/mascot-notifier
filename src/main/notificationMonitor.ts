import type { BaseNotificationMonitor } from './monitors/base';
import { MacNotificationMonitor } from './monitors/mac';
import { WindowsNotificationMonitor } from './monitors/windows';

export type { BaseNotificationMonitor };

export function createNotificationMonitor(): BaseNotificationMonitor {
  if (process.platform === 'win32') {
    return new WindowsNotificationMonitor();
  }
  if (process.platform === 'darwin') {
    return new MacNotificationMonitor();
  }
  throw new Error(`Unsupported platform for notification monitoring: ${process.platform}`);
}

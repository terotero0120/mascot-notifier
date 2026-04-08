import type { BaseNotificationMonitor } from './monitors/base';
import { MacNotificationMonitor } from './monitors/mac';
import { WindowsNotificationMonitor } from './monitors/windows';

export type { NotificationData } from './monitors/base';
export type { BaseNotificationMonitor };

export function createNotificationMonitor(): BaseNotificationMonitor {
  if (process.platform === 'win32') {
    return new WindowsNotificationMonitor();
  }
  return new MacNotificationMonitor();
}

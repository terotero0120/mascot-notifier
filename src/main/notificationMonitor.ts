import { MacNotificationMonitor } from './monitors/mac';
import { WindowsNotificationMonitor } from './monitors/windows';

export type { NotificationData } from './monitors/base';
export type { BaseNotificationMonitor as NotificationMonitor } from './monitors/base';

export function createNotificationMonitor(): MacNotificationMonitor | WindowsNotificationMonitor {
  if (process.platform === 'win32') {
    return new WindowsNotificationMonitor();
  }
  return new MacNotificationMonitor();
}

import type { BaseNotificationMonitor } from './monitors/base';

export type { NotificationData } from './monitors/base';
export type { BaseNotificationMonitor };

export function createNotificationMonitor(): BaseNotificationMonitor {
  if (process.platform === 'win32') {
    // eslint-disable-next-line no-eval
    const { WindowsNotificationMonitor } = (eval('require') as NodeRequire)('./monitors/windows');
    return new WindowsNotificationMonitor();
  }
  // eslint-disable-next-line no-eval
  const { MacNotificationMonitor } = (eval('require') as NodeRequire)('./monitors/mac');
  return new MacNotificationMonitor();
}

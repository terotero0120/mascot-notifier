import { EventEmitter } from 'node:events';

export interface NotificationData {
  sender: string;
  body: string;
}

/**
 * Base class for platform-specific notification monitors.
 *
 * Events:
 *   'started'          - fired once after the first successful poll
 *   'notification'     - fired with NotificationData when a new notification arrives
 *   'permission-error' - fired when the monitor cannot access the notification store
 */
export abstract class BaseNotificationMonitor extends EventEmitter {
  abstract start(): void;
  abstract stop(): void;
}

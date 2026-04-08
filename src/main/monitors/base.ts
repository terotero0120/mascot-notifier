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
  private startedEmitted = false;
  private errorEmitted = false;
  protected seenIds = new Set<number>();

  abstract start(): void;
  abstract stop(): void;

  protected emitStartedOnce(): void {
    if (!this.startedEmitted) {
      this.startedEmitted = true;
      this.emit('started');
    }
  }

  protected emitPermissionErrorOnce(): void {
    if (!this.errorEmitted) {
      this.errorEmitted = true;
      this.emit('permission-error');
    }
  }

  protected trimSeenCache(): void {
    if (this.seenIds.size > 500) {
      let toRemove = this.seenIds.size - 200;
      for (const id of this.seenIds) {
        if (toRemove-- <= 0) break;
        this.seenIds.delete(id);
      }
    }
  }
}

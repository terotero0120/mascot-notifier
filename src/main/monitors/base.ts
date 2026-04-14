import { EventEmitter } from 'node:events';

export interface NotificationData {
  sender: string;
  body: string;
  appName?: string;
  dbId?: string;
  unixMs?: number;
  rawId?: string;
}

export interface LatestNotificationRecord {
  id: number;
  timestamp: string;
  unixMs: number;
  sender: string;
  body: string;
  appName: string;
  rawId: string;
  displayedByApp: boolean;
}

export function formatNotificationTimestamp(unixMs: number): string {
  return new Date(unixMs).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  protected readonly pollIntervalMs = 3000;
  protected seenIds = new Set<number>();

  protected abstract poll(): Promise<void>;
  abstract fetchLatest(n: number): Promise<LatestNotificationRecord[]>;

  start(): void {
    if (this.intervalId) return;
    this.onStart();
    this.intervalId = setInterval(() => {
      if (!this.polling) {
        this.polling = true;
        this.poll().finally(() => {
          this.polling = false;
        });
      }
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onStop();
  }

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    if (!this.intervalId) return false;
    return super.emit(event, ...args);
  }

  protected onStart(): void {}
  protected onStop(): void {}

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

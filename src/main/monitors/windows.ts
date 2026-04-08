import os from 'node:os';
import path from 'node:path';
import { BaseNotificationMonitor } from './base';

// eslint-disable-next-line no-eval
const nativeRequire = eval('require') as NodeRequire;
const Database = nativeRequire('better-sqlite3') as typeof import('better-sqlite3');

/**
 * Windows notification monitor.
 *
 * Polls the Windows notification SQLite database using better-sqlite3.
 * DB: %LOCALAPPDATA%\Microsoft\Windows\Notifications\wpndatabase.db
 *
 * better-sqlite3 handles WAL mode correctly, ensuring new notifications
 * in the WAL file are visible immediately.
 */
export class WindowsNotificationMonitor extends BaseNotificationMonitor {
  private static readonly FILETIME_UNIX_EPOCH_OFFSET = 11644473600;
  private static readonly FILETIME_TICKS_PER_SECOND = 10_000_000;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs = 3000;
  private lastArrivalTime = 0;
  private dbPath = '';

  start(): void {
    this.lastArrivalTime =
      (Math.floor(Date.now() / 1000) + WindowsNotificationMonitor.FILETIME_UNIX_EPOCH_OFFSET) *
      WindowsNotificationMonitor.FILETIME_TICKS_PER_SECOND;
    this.dbPath = path.join(
      os.homedir(),
      'AppData',
      'Local',
      'Microsoft',
      'Windows',
      'Notifications',
      'wpndatabase.db',
    );
    this.intervalId = setInterval(() => this.poll(), this.pollIntervalMs);
    console.log('WindowsNotificationMonitor started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('WindowsNotificationMonitor stopped');
  }

  private poll(): void {
    try {
      const db = new Database(this.dbPath, { readonly: true, fileMustExist: true });

      const rows = db
        .prepare(
          `
          SELECT n.Id, n.ArrivalTime, n.Payload, h.PrimaryId
          FROM Notification n
          LEFT JOIN NotificationHandler h ON n.HandlerId = h.RecordId
          WHERE n.ArrivalTime >= ? AND n.Type = 'toast'
          ORDER BY n.ArrivalTime ASC
        `,
        )
        .all(this.lastArrivalTime) as Array<{
        Id: number;
        ArrivalTime: number;
        Payload: Buffer | string;
        PrimaryId: string | null;
      }>;

      db.close();

      this.emitStartedOnce();

      for (const row of rows) {
        if (this.seenIds.has(row.Id)) continue;
        this.seenIds.add(row.Id);

        const payload = Buffer.isBuffer(row.Payload)
          ? row.Payload.toString('utf-8')
          : String(row.Payload);
        const notification = this.parsePayload(payload, row.PrimaryId);
        if (notification) {
          console.log('New notification:', notification.sender, '-', notification.body);
          this.emit('notification', notification);
        }
      }

      if (rows.length > 0) {
        this.lastArrivalTime = rows[rows.length - 1].ArrivalTime;
      }

      this.trimSeenCache();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      console.error('WindowsNotificationMonitor poll error:', error.message);
      if (
        error.message?.includes('SQLITE_CANTOPEN') ||
        error.message?.includes('unable to open database') ||
        error.code === 'ENOENT' ||
        error.code === 'EACCES'
      ) {
        this.emitPermissionErrorOnce();
      }
    }
  }

  private parsePayload(
    payload: string,
    appId: string | null,
  ): { sender: string; body: string } | null {
    try {
      const texts = [...payload.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)].map((m) =>
        m[1].trim(),
      );
      if (texts.length === 0) return null;

      const body = texts.length >= 2 ? texts[1] : texts[0];
      const sender =
        texts.length >= 2 ? texts[0] : (appId?.split('.').pop()?.replace(/_.*$/, '') ?? '');

      if (!body) return null;
      return { sender: sender || 'Unknown', body };
    } catch (err) {
      console.error('Failed to parse notification payload:', err);
      return null;
    }
  }
}

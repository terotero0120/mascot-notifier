import os from 'node:os';
import path from 'node:path';
import { resolveAppName } from '../appNameResolver';
import {
  BaseNotificationMonitor,
  formatNotificationTimestamp,
  type LatestNotificationRecord,
} from './base';

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

  private lastArrivalTime = 0;
  private dbPath = '';

  protected onStart(): void {
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
    console.log('WindowsNotificationMonitor started');
  }

  protected onStop(): void {
    console.log('WindowsNotificationMonitor stopped');
  }

  protected async poll(): Promise<void> {
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

      const newRows = rows.filter((row) => {
        if (this.seenIds.has(row.Id)) return false;
        this.seenIds.add(row.Id);
        return true;
      });

      const parsed = newRows
        .map((row) => {
          const payload = Buffer.isBuffer(row.Payload)
            ? row.Payload.toString('utf-8')
            : String(row.Payload);
          return this.parsePayload(payload, row.PrimaryId);
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      const appNames = await Promise.all(parsed.map((p) => resolveAppName(p.appId)));

      for (let i = 0; i < parsed.length; i++) {
        const { sender, body, appId } = parsed[i];
        const appName = appNames[i];
        console.log('New notification:', appName, `(${appId})`, '-', sender, '-', body);
        this.emit('notification', { sender, body, appName });
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

  async fetchLatest(n: number): Promise<LatestNotificationRecord[]> {
    const dbPath =
      this.dbPath ||
      path.join(
        os.homedir(),
        'AppData',
        'Local',
        'Microsoft',
        'Windows',
        'Notifications',
        'wpndatabase.db',
      );

    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db
      .prepare(`
        SELECT n.Id, n.ArrivalTime, n.Payload, h.PrimaryId
        FROM Notification n
        LEFT JOIN NotificationHandler h ON n.HandlerId = h.RecordId
        WHERE n.Type = 'toast'
        ORDER BY n.ArrivalTime DESC
        LIMIT ?
      `)
      .all(n) as Array<{
      Id: number;
      ArrivalTime: number;
      Payload: Buffer | string;
      PrimaryId: string | null;
    }>;
    db.close();

    return await Promise.all(
      rows.map(async (row) => {
        const unixSeconds =
          row.ArrivalTime / WindowsNotificationMonitor.FILETIME_TICKS_PER_SECOND -
          WindowsNotificationMonitor.FILETIME_UNIX_EPOCH_OFFSET;
        const timestamp = formatNotificationTimestamp(unixSeconds * 1000);

        const payload = Buffer.isBuffer(row.Payload)
          ? row.Payload.toString('utf-8')
          : String(row.Payload);
        const p = this.parsePayload(payload, row.PrimaryId);
        if (p !== null) {
          const appName = await resolveAppName(p.appId);
          return { id: row.Id, timestamp, sender: p.sender, body: p.body, appName, rawId: p.appId };
        }

        const appId = row.PrimaryId ?? '';
        return {
          id: row.Id,
          timestamp,
          sender: '(不明)',
          body: '(パース失敗)',
          appName: appId || '(不明)',
          rawId: appId,
        };
      }),
    );
  }

  private parsePayload(
    payload: string,
    appId: string | null,
  ): { sender: string; body: string; appId: string } | null {
    try {
      const texts = [...payload.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)].map((m) =>
        m[1].trim(),
      );
      if (texts.length === 0) return null;

      const body = texts.length >= 2 ? texts[1] : texts[0];
      const sender =
        texts.length >= 2 ? texts[0] : (appId?.split('.').pop()?.replace(/_.*$/, '') ?? '');

      if (!body) return null;
      return { sender: sender || 'Unknown', body, appId: appId ?? '' };
    } catch (err) {
      console.error('Failed to parse notification payload:', err);
      return null;
    }
  }
}

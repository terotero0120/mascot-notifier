import os from 'node:os';
import path from 'node:path';
import { resolveAppName } from '../appNameResolver';
import {
  BaseNotificationMonitor,
  formatNotificationTimestamp,
  type LatestNotificationRecord,
} from './base';
import { fileTimeToUnixMs, parseWindowsPayload, unixSecondsToFileTime } from './windowsParser';

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
  private lastArrivalTime = 0;
  private dbPath = '';

  protected onStart(): void {
    this.lastArrivalTime = unixSecondsToFileTime(Math.floor(Date.now() / 1000));
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

      const results = await Promise.all(
        newRows.map(async (row) => {
          const payload = Buffer.isBuffer(row.Payload)
            ? row.Payload.toString('utf-8')
            : String(row.Payload);
          const p = parseWindowsPayload(payload, row.PrimaryId);
          if (p === null) return null;
          const appName = await resolveAppName(p.appId);
          return {
            sender: p.sender,
            body: p.body,
            appName,
            dbId: String(row.Id),
            unixMs: fileTimeToUnixMs(row.ArrivalTime),
            rawId: p.appId,
          };
        }),
      );

      for (const n of results) {
        if (n === null) continue;
        console.log('New notification:', n.appName, `(${n.rawId})`, '-', n.sender, '-', n.body);
        this.emit('notification', n);
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
    let rows: Array<{
      Id: number;
      ArrivalTime: number;
      Payload: Buffer | string;
      PrimaryId: string | null;
    }>;
    try {
      rows = db
        .prepare(`
          SELECT n.Id, n.ArrivalTime, n.Payload, h.PrimaryId
          FROM Notification n
          LEFT JOIN NotificationHandler h ON n.HandlerId = h.RecordId
          WHERE n.Type = 'toast'
          ORDER BY n.ArrivalTime DESC
          LIMIT ?
        `)
        .all(n) as typeof rows;
    } finally {
      db.close();
    }

    return await Promise.all(
      rows.map(async (row) => {
        const timestamp = formatNotificationTimestamp(fileTimeToUnixMs(row.ArrivalTime));

        const payload = Buffer.isBuffer(row.Payload)
          ? row.Payload.toString('utf-8')
          : String(row.Payload);
        const p = parseWindowsPayload(payload, row.PrimaryId);
        const unixMs = fileTimeToUnixMs(row.ArrivalTime);
        if (p !== null) {
          const appName = await resolveAppName(p.appId);
          return {
            id: row.Id,
            timestamp,
            unixMs,
            sender: p.sender,
            body: p.body,
            appName,
            rawId: p.appId,
            displayedByApp: false,
          };
        }

        const appId = row.PrimaryId ?? '';
        return {
          id: row.Id,
          timestamp,
          unixMs,
          sender: '(不明)',
          body: '(パース失敗)',
          appName: appId || '(不明)',
          rawId: appId,
          displayedByApp: false,
        };
      }),
    );
  }
}

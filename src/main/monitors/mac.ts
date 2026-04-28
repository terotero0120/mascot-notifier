import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAppName } from '../appNameResolver';
import {
  BaseNotificationMonitor,
  formatNotificationTimestamp,
  type LatestNotificationRecord,
} from './base';
import { extractMacNotification } from './macParser';

// eslint-disable-next-line no-eval
const nativeRequire = eval('require') as NodeRequire;
const Database = nativeRequire('better-sqlite3') as typeof import('better-sqlite3');
const bplist = nativeRequire('bplist-parser') as { parseBuffer: (buf: Buffer) => unknown[] };

export class MacNotificationMonitor extends BaseNotificationMonitor {
  private static readonly CORE_DATA_EPOCH_OFFSET = 978307200;

  private lastCheckTime: number = Date.now();
  private dbPath: string | null = null;

  private static resolveDbPath(): string {
    if (process.env.NOTIFICATION_DB_PATH) {
      return process.env.NOTIFICATION_DB_PATH;
    }
    const newPath = path.join(
      os.homedir(),
      'Library/Group Containers/group.com.apple.usernoted/db2/db',
    );
    const legacyPath = path.join(
      os.homedir(),
      'Library/Application Support/com.apple.notificationcenter/db2/db',
    );
    return fs.existsSync(newPath) ? newPath : legacyPath;
  }

  protected onStart(): void {
    this.dbPath = MacNotificationMonitor.resolveDbPath();
    this.lastCheckTime = Date.now();
    console.log('MacNotificationMonitor started, DB:', this.dbPath);
  }

  protected onStop(): void {
    console.log('MacNotificationMonitor stopped');
  }

  protected async poll(): Promise<void> {
    if (!this.dbPath) return;

    try {
      const db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      const since = this.lastCheckTime / 1000 - MacNotificationMonitor.CORE_DATA_EPOCH_OFFSET;
      let rows: Array<{ rec_id: number; data: Buffer; delivered_date: number }>;
      try {
        rows = db
          .prepare(`
            SELECT rec.rec_id, rec.data, rec.delivered_date
            FROM record AS rec
            WHERE rec.delivered_date > ?
            ORDER BY rec.delivered_date ASC
          `)
          .all(since) as typeof rows;
      } finally {
        db.close();
      }

      this.emitStartedOnce();

      const newRows = rows.filter((row) => {
        if (this.seenIds.has(row.rec_id)) return false;
        this.seenIds.add(row.rec_id);
        return true;
      });

      const results = await Promise.all(
        newRows.map(async (row) => {
          const p = this.parseNotificationData(row.data);
          if (p === null) return null;
          const appName = await resolveAppName(p.bundleId);
          return {
            sender: p.sender,
            body: p.body,
            appName,
            dbId: String(row.rec_id),
            unixMs: (row.delivered_date + MacNotificationMonitor.CORE_DATA_EPOCH_OFFSET) * 1000,
            rawId: p.bundleId,
          };
        }),
      );

      for (const n of results) {
        if (n === null) continue;
        this.emit('notification', n);
      }

      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        this.lastCheckTime =
          (lastRow.delivered_date + MacNotificationMonitor.CORE_DATA_EPOCH_OFFSET) * 1000;
      }

      this.trimSeenCache();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      const message = (err as Error).message;
      console.error('MacNotificationMonitor poll error:', message);
      if (
        code === 'ENOENT' ||
        code === 'EACCES' ||
        code === 'SQLITE_CANTOPEN' ||
        message.includes('unable to open database') ||
        message.includes('directory does not exist')
      ) {
        this.emitPermissionErrorOnce();
      }
    }
  }

  async fetchLatest(n: number): Promise<LatestNotificationRecord[]> {
    const dbPath = this.dbPath ?? MacNotificationMonitor.resolveDbPath();

    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    let rows: Array<{ rec_id: number; data: Buffer; delivered_date: number }>;
    try {
      rows = db
        .prepare(`
          SELECT rec.rec_id, rec.data, rec.delivered_date
          FROM record AS rec
          ORDER BY rec.delivered_date DESC
          LIMIT ?
        `)
        .all(n) as typeof rows;
    } finally {
      db.close();
    }

    return await Promise.all(
      rows.map(async (row) => {
        const timestamp = formatNotificationTimestamp(
          (row.delivered_date + MacNotificationMonitor.CORE_DATA_EPOCH_OFFSET) * 1000,
        );

        const p = this.parseNotificationData(row.data);
        const unixMs = (row.delivered_date + MacNotificationMonitor.CORE_DATA_EPOCH_OFFSET) * 1000;
        if (p !== null) {
          const appName = await resolveAppName(p.bundleId);
          return {
            id: row.rec_id,
            timestamp,
            unixMs,
            sender: p.sender,
            body: p.body,
            appName,
            rawId: p.bundleId,
            displayedByApp: false,
          };
        }

        let bundleId = '';
        try {
          const raw = bplist.parseBuffer(row.data);
          if (raw?.[0]) {
            const root = raw[0] as Record<string, unknown>;
            bundleId = typeof root.app === 'string' ? root.app : '';
          }
        } catch {
          // ignore
        }
        return {
          id: row.rec_id,
          timestamp,
          unixMs,
          sender: '(不明)',
          body: '(パース失敗)',
          appName: bundleId || '(不明)',
          rawId: bundleId,
          displayedByApp: false,
        };
      }),
    );
  }

  private parseNotificationData(
    data: Buffer,
  ): { sender: string; body: string; bundleId: string } | null {
    try {
      const parsed = bplist.parseBuffer(data);
      if (!parsed?.[0]) return null;
      return extractMacNotification(parsed[0] as Record<string, unknown>);
    } catch (err) {
      console.error('Failed to parse notification data:', err);
      return null;
    }
  }
}

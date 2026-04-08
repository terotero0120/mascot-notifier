import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BaseNotificationMonitor } from './base';

// eslint-disable-next-line no-eval
const nativeRequire = eval('require') as NodeRequire;
const Database = nativeRequire('better-sqlite3') as typeof import('better-sqlite3');
const bplist = nativeRequire('bplist-parser') as { parseBuffer: (buf: Buffer) => unknown[] };

export class MacNotificationMonitor extends BaseNotificationMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastCheckTime: number = Date.now();
  private readonly pollIntervalMs = 3000;
  private dbPath: string | null = null;

  start(): void {
    const newPath = path.join(
      os.homedir(),
      'Library/Group Containers/group.com.apple.usernoted/db2/db',
    );
    const legacyPath = path.join(
      os.homedir(),
      'Library/Application Support/com.apple.notificationcenter/db2/db',
    );
    this.dbPath = fs.existsSync(newPath) ? newPath : legacyPath;

    this.lastCheckTime = Date.now();
    this.intervalId = setInterval(() => this.poll(), this.pollIntervalMs);
    console.log('MacNotificationMonitor started, DB:', this.dbPath);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('MacNotificationMonitor stopped');
  }

  private poll(): void {
    if (!this.dbPath) return;

    try {
      const db = new Database(this.dbPath, { readonly: true, fileMustExist: true });

      // Core Data epoch: 2001-01-01 is 978307200 seconds after Unix epoch
      const since = this.lastCheckTime / 1000 - 978307200;
      const rows = db
        .prepare(`
          SELECT rec.rec_id, rec.data, rec.delivered_date
          FROM record AS rec
          WHERE rec.delivered_date > ?
          ORDER BY rec.delivered_date ASC
        `)
        .all(since) as Array<{ rec_id: number; data: Buffer; delivered_date: number }>;

      db.close();

      this.emitStartedOnce();

      for (const row of rows) {
        if (this.seenIds.has(row.rec_id)) continue;
        this.seenIds.add(row.rec_id);

        const notification = this.parseNotificationData(row.data);
        if (notification) {
          console.log('New notification:', notification.sender, '-', notification.body);
          this.emit('notification', notification);
        }
      }

      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        this.lastCheckTime = (lastRow.delivered_date + 978307200) * 1000;
      }

      this.trimSeenCache();
    } catch (err) {
      const message = (err as Error).message;
      console.error('MacNotificationMonitor poll error:', message);
      if (
        message.includes('SQLITE_CANTOPEN') ||
        message.includes('unable to open database') ||
        message.includes('directory does not exist')
      ) {
        this.emitPermissionErrorOnce();
      }
    }
  }

  private parseNotificationData(data: Buffer): { sender: string; body: string } | null {
    try {
      const parsed = bplist.parseBuffer(data);
      if (!parsed?.[0]) return null;

      const root = parsed[0] as Record<string, unknown>;
      const req = root.req as Record<string, unknown> | undefined;
      if (!req) return null;

      let body = '';
      let sender = '';

      if (typeof req.body === 'string') {
        body = req.body;
      } else if (Array.isArray(req.body)) {
        const strings = (req.body as unknown[]).filter(
          (item): item is string => typeof item === 'string' && !item.includes('Notification'),
        );
        body = strings[0] || String(req.body);
      }

      if (typeof req.titl === 'string') {
        sender = req.titl;
      }

      if (!sender && typeof root.app === 'string') {
        const bundleId = root.app as string;
        const parts = bundleId.split('.');
        sender = parts[parts.length - 1];
      }

      if (!body) return null;

      return { sender: sender || 'Unknown', body };
    } catch (err) {
      console.error('Failed to parse notification data:', err);
      return null;
    }
  }
}

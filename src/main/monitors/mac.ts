import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAppName } from '../appNameResolver';
import { BaseNotificationMonitor } from './base';

// eslint-disable-next-line no-eval
const nativeRequire = eval('require') as NodeRequire;
const Database = nativeRequire('better-sqlite3') as typeof import('better-sqlite3');
const bplist = nativeRequire('bplist-parser') as { parseBuffer: (buf: Buffer) => unknown[] };

export class MacNotificationMonitor extends BaseNotificationMonitor {
  private lastCheckTime: number = Date.now();
  private dbPath: string | null = null;

  protected onStart(): void {
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
    console.log('MacNotificationMonitor started, DB:', this.dbPath);
  }

  protected onStop(): void {
    console.log('MacNotificationMonitor stopped');
  }

  protected async poll(): Promise<void> {
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

      const newRows = rows.filter((row) => {
        if (this.seenIds.has(row.rec_id)) return false;
        this.seenIds.add(row.rec_id);
        return true;
      });

      const parsed = newRows
        .map((row) => this.parseNotificationData(row.data))
        .filter((p): p is NonNullable<typeof p> => p !== null);

      const appNames = await Promise.all(parsed.map((p) => resolveAppName(p.bundleId)));

      for (let i = 0; i < parsed.length; i++) {
        const { sender, body } = parsed[i];
        const appName = appNames[i];
        console.log('New notification:', appName, '-', sender, '-', body);
        this.emit('notification', { sender, body, appName });
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

  private parseNotificationData(
    data: Buffer,
  ): { sender: string; body: string; bundleId: string } | null {
    try {
      const parsed = bplist.parseBuffer(data);
      if (!parsed?.[0]) return null;

      const root = parsed[0] as Record<string, unknown>;
      const req = root.req as Record<string, unknown> | undefined;
      if (!req) return null;

      let body = '';
      let sender = '';
      const bundleId = typeof root.app === 'string' ? (root.app as string) : '';

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

      if (!sender && bundleId) {
        const parts = bundleId.split('.');
        sender = parts[parts.length - 1];
      }

      if (!body) return null;

      return { sender: sender || 'Unknown', body, bundleId };
    } catch (err) {
      console.error('Failed to parse notification data:', err);
      return null;
    }
  }
}

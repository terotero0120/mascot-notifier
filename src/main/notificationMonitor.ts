import { EventEmitter } from 'events'
import path from 'path'
import os from 'os'
import fs from 'fs'
// Use eval('require') to bypass Vite/Rollup bundling for native modules
// eslint-disable-next-line no-eval
const nativeRequire = eval('require') as NodeRequire
const Database = nativeRequire('better-sqlite3') as typeof import('better-sqlite3')
const bplist = nativeRequire('bplist-parser') as { parseBuffer: (buf: Buffer) => unknown[] }

export interface NotificationData {
  sender: string
  body: string
}

export class NotificationMonitor extends EventEmitter {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private lastCheckTime: number = Date.now()
  private readonly pollIntervalMs = 3000
  private dbErrorLogged = false
  private startedEmitted = false
  private dbPath: string | null = null
  private seenRecIds = new Set<number>()

  start(): void {
    if (process.platform !== 'darwin') {
      console.warn('NotificationMonitor: macOS only for now')
      return
    }

    // Resolve DB path once
    const newPath = path.join(
      os.homedir(),
      'Library/Group Containers/group.com.apple.usernoted/db2/db'
    )
    const legacyPath = path.join(
      os.homedir(),
      'Library/Application Support/com.apple.notificationcenter/db2/db'
    )
    this.dbPath = fs.existsSync(newPath) ? newPath : legacyPath

    this.lastCheckTime = Date.now()
    this.intervalId = setInterval(() => this.poll(), this.pollIntervalMs)
    console.log('NotificationMonitor started, DB:', this.dbPath)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('NotificationMonitor stopped')
  }

  private poll(): void {
    if (!this.dbPath) return

    try {
      const db = new Database(this.dbPath, { readonly: true, fileMustExist: true })

      // macOS Core Data timestamp epoch: 2001-01-01 (978307200 seconds from Unix epoch)
      const since = this.lastCheckTime / 1000 - 978307200
      const rows = db.prepare(`
        SELECT rec.rec_id, rec.data, rec.delivered_date
        FROM record AS rec
        WHERE rec.delivered_date > ?
        ORDER BY rec.delivered_date ASC
      `).all(since) as Array<{ rec_id: number; data: Buffer; delivered_date: number }>

      db.close()

      if (!this.startedEmitted) {
        this.startedEmitted = true
        this.emit('started')
      }

      for (const row of rows) {
        if (this.seenRecIds.has(row.rec_id)) continue
        this.seenRecIds.add(row.rec_id)

        const notification = this.parseNotificationData(row.data)
        if (notification) {
          console.log('New notification:', notification.sender, '-', notification.body)
          this.emit('notification', notification)
        }
      }

      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1]
        this.lastCheckTime = (lastRow.delivered_date + 978307200) * 1000
      }

      // Prevent seenRecIds from growing unbounded
      if (this.seenRecIds.size > 500) {
        const arr = [...this.seenRecIds]
        this.seenRecIds = new Set(arr.slice(-200))
      }
    } catch (err) {
      if (!this.dbErrorLogged) {
        const message = (err as Error).message
        console.error('NotificationMonitor poll error:', message)
        if (message.includes('SQLITE_CANTOPEN') || message.includes('unable to open database') || message.includes('directory does not exist')) {
          this.emit('permission-error')
        }
        this.dbErrorLogged = true
      }
    }
  }

  private parseNotificationData(data: Buffer): NotificationData | null {
    try {
      const parsed = bplist.parseBuffer(data)
      if (!parsed || !parsed[0]) return null

      const root = parsed[0] as Record<string, unknown>

      // macOS notification bplist structure:
      // root.req.titl = title/sender
      // root.req.body = message body
      // root.app = bundle identifier
      const req = root.req as Record<string, unknown> | undefined
      if (!req) return null

      let body = ''
      let sender = ''

      // Extract body
      if (typeof req.body === 'string') {
        body = req.body
      } else if (Array.isArray(req.body)) {
        // Some notifications use array format (e.g. ScreenTime)
        // Find the first plain string that's not a template key
        const strings = (req.body as unknown[]).filter(
          (item): item is string => typeof item === 'string' && !item.includes('Notification')
        )
        body = strings[0] || String(req.body)
      }

      // Extract title/sender
      if (typeof req.titl === 'string') {
        sender = req.titl
      }

      // Fallback: use app bundle ID as sender
      if (!sender && typeof root.app === 'string') {
        const bundleId = root.app as string
        // Extract readable name from bundle ID (e.g. com.tinyspeck.slackmacgap -> slackmacgap)
        const parts = bundleId.split('.')
        sender = parts[parts.length - 1]
      }

      if (!body) return null

      return { sender: sender || 'Unknown', body }
    } catch (err) {
      console.error('Failed to parse notification data:', err)
      return null
    }
  }
}

import { spawn } from 'node:child_process';
import { BaseNotificationMonitor } from './base';

/**
 * Windows notification monitor.
 *
 * Windows does not expose a simple SQLite database like macOS.
 * This implementation polls the Windows Action Center via PowerShell.
 *
 * Known limitations:
 *   - Requires PowerShell 5+ (bundled with Windows 10/11)
 *   - Only notifications still present in Action Center are visible
 *   - Some apps suppress Action Center history
 *
 * TODO: Replace with WinRT native binding for more reliable delivery
 *       (e.g. Windows.UI.Notifications.NotificationListener API)
 */
export class WindowsNotificationMonitor extends BaseNotificationMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs = 3000;
  private startedEmitted = false;
  private seenIds = new Set<string>();

  // PowerShell script that reads Action Center toast history via WinRT
  private static readonly PS_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.UI.Notifications.NotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime]
$listener = [Windows.UI.Notifications.NotificationListener]::Current
$access = $listener.RequestAccessAsync().GetAwaiter().GetResult()
if ($access -ne 'Allowed') { exit 1 }
$history = [Windows.UI.Notifications.NotificationListener]::Current.ReadHistory()
$results = @()
foreach ($n in $history) {
  $content = $n.Notification.Content
  $title = $content.GetElementsByTagName("text") | Select-Object -First 1 -ExpandProperty InnerText
  $body  = $content.GetElementsByTagName("text") | Select-Object -Skip 1 -First 1 -ExpandProperty InnerText
  $app   = $n.AppInfo.DisplayInfo.DisplayName
  $id    = [string]$n.Notification.Tag + [string]$n.Notification.Group + [string]$n.CreationTime.Ticks
  $results += [PSCustomObject]@{ id=$id; sender=if($title){$title}else{$app}; body=$body }
}
$results | ConvertTo-Json -Compress
`.trim();

  start(): void {
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
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', WindowsNotificationMonitor.PS_SCRIPT]);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    ps.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    ps.on('close', (code) => {
      if (!this.startedEmitted) {
        this.startedEmitted = true;
        this.emit('started');
      }

      if (code !== 0) {
        console.error('WindowsNotificationMonitor PowerShell error:', stderr.trim());
        this.emit('permission-error');
        return;
      }

      if (!stdout.trim()) return;

      try {
        const raw = JSON.parse(stdout.trim());
        const items: Array<{ id: string; sender: string; body: string }> = Array.isArray(raw) ? raw : [raw];

        for (const item of items) {
          if (!item.id || this.seenIds.has(item.id)) continue;
          this.seenIds.add(item.id);
          if (!item.body) continue;
          console.log('New notification:', item.sender, '-', item.body);
          this.emit('notification', { sender: item.sender || 'Unknown', body: item.body });
        }

        // Prevent seenIds from growing unbounded
        if (this.seenIds.size > 500) {
          const arr = [...this.seenIds];
          this.seenIds = new Set(arr.slice(-200));
        }
      } catch (err) {
        console.error('WindowsNotificationMonitor parse error:', err);
      }
    });
  }
}

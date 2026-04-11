import { describe, expect, it } from 'vitest';
import {
  BaseNotificationMonitor,
  formatNotificationTimestamp,
  type LatestNotificationRecord,
} from './base';

describe('formatNotificationTimestamp', () => {
  it('zero-pads month, day, hour, minute and second in ja-JP locale', () => {
    // 2024-01-02 03:04:05 local time
    const ms = new Date(2024, 0, 2, 3, 4, 5).getTime();
    const out = formatNotificationTimestamp(ms);
    // ja-JP returns like "2024/01/02 03:04:05"
    expect(out).toMatch(/2024[/-]01[/-]02\s+03:04:05/);
  });

  it('formats a realistic notification time', () => {
    const ms = new Date(2026, 3, 10, 23, 59, 0).getTime();
    const out = formatNotificationTimestamp(ms);
    expect(out).toMatch(/2026[/-]04[/-]10\s+23:59:00/);
  });
});

// Test subclass to expose protected internals for unit testing.
class TestMonitor extends BaseNotificationMonitor {
  protected async poll(): Promise<void> {}
  async fetchLatest(_n: number): Promise<LatestNotificationRecord[]> {
    return [];
  }

  addSeen(id: number): void {
    this.seenIds.add(id);
  }

  seenSize(): number {
    return this.seenIds.size;
  }

  hasSeen(id: number): boolean {
    return this.seenIds.has(id);
  }

  runTrim(): void {
    this.trimSeenCache();
  }
}

describe('BaseNotificationMonitor.trimSeenCache', () => {
  it('is a no-op when cache size is at or below 500', () => {
    const m = new TestMonitor();
    for (let i = 0; i < 500; i++) m.addSeen(i);
    m.runTrim();
    expect(m.seenSize()).toBe(500);
  });

  it('trims down to 200 when size exceeds 500', () => {
    const m = new TestMonitor();
    for (let i = 0; i < 600; i++) m.addSeen(i);
    m.runTrim();
    expect(m.seenSize()).toBe(200);
  });

  it('removes oldest entries first (insertion order)', () => {
    const m = new TestMonitor();
    for (let i = 0; i < 600; i++) m.addSeen(i);
    m.runTrim();
    // After trimming 600 - 200 = 400 items, the oldest 400 (ids 0..399) should be gone
    expect(m.hasSeen(0)).toBe(false);
    expect(m.hasSeen(399)).toBe(false);
    expect(m.hasSeen(400)).toBe(true);
    expect(m.hasSeen(599)).toBe(true);
  });
});

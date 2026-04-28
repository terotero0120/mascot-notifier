import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/mascot-test'),
  },
}));

const readFileSyncMock = vi.fn();
const writeFileMock = vi.fn();
const renameMock = vi.fn();

vi.mock('node:fs', () => ({
  default: {
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
    promises: {
      writeFile: (...args: unknown[]) => writeFileMock(...args),
      rename: (...args: unknown[]) => renameMock(...args),
    },
  },
}));

import {
  _resetStateForTesting,
  addDisplayedNotification,
  flushNotificationHistory,
  getHistoryData,
} from './notificationHistory';

describe('notificationHistory', () => {
  beforeEach(() => {
    _resetStateForTesting();
    readFileSyncMock.mockReset();
    writeFileMock.mockReset();
    renameMock.mockReset();
    readFileSyncMock.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue(undefined);
  });

  describe('addDisplayedNotification', () => {
    it('ignores entries without dbId', async () => {
      addDisplayedNotification({ sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('deduplicates entries with the same dbId', async () => {
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello again' });
      await flushNotificationHistory();
      const lastCall = writeFileMock.mock.calls[writeFileMock.mock.calls.length - 1];
      const written = JSON.parse(lastCall[1] as string) as unknown[];
      expect(written).toHaveLength(1);
    });

    it('serializes concurrent writes so the latest snapshot is written last', async () => {
      let resolveFirst: (() => void) | undefined;
      writeFileMock
        .mockImplementationOnce(
          () =>
            new Promise<void>((r) => {
              resolveFirst = r;
            }),
        )
        .mockResolvedValue(undefined);

      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      // Yield to allow the first write to be queued
      await new Promise((resolve) => setImmediate(resolve));
      addDisplayedNotification({ dbId: '2', sender: 'Bob', body: 'World' });

      if (resolveFirst) {
        resolveFirst();
      }
      await flushNotificationHistory();

      expect(writeFileMock).toHaveBeenCalledTimes(2);
      const lastWrite = JSON.parse(writeFileMock.mock.calls[1][1] as string) as Array<{
        dbId: string;
      }>;
      expect(lastWrite).toHaveLength(2);
      expect(lastWrite[0].dbId).toBe('2');
      expect(lastWrite[1].dbId).toBe('1');
    });

    it('writes to a tmp file and renames to the final path (atomic write)', async () => {
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();

      const tmpPath = writeFileMock.mock.calls[0][0] as string;
      const [renameSrc, renameDst] = renameMock.mock.calls[0] as [string, string];
      expect(tmpPath).toBe('/tmp/mascot-test/displayed-notifications.json.tmp');
      expect(renameSrc).toBe('/tmp/mascot-test/displayed-notifications.json.tmp');
      expect(renameDst).toBe('/tmp/mascot-test/displayed-notifications.json');
    });
  });

  describe('getEntries shape validation', () => {
    it('falls back to empty array when parsed value is not an array', () => {
      readFileSyncMock.mockReturnValue('{}');
      const data = getHistoryData(new Set());
      expect(data.displayedIds.size).toBe(0);
      expect(data.historyOnly).toHaveLength(0);
    });

    it('filters out null elements', () => {
      readFileSyncMock.mockReturnValue('[null]');
      const data = getHistoryData(new Set());
      expect(data.displayedIds.size).toBe(0);
    });

    it('filters out elements missing dbId', () => {
      readFileSyncMock.mockReturnValue('[{"sender":"Alice","body":"Hi"}]');
      const data = getHistoryData(new Set());
      expect(data.displayedIds.size).toBe(0);
    });

    it('filters out elements with non-string dbId', () => {
      readFileSyncMock.mockReturnValue('[{"dbId":123,"sender":"Alice","body":"Hi"}]');
      const data = getHistoryData(new Set());
      expect(data.displayedIds.size).toBe(0);
    });

    it('filters out entries with dbId but missing required numeric unixMs', () => {
      readFileSyncMock.mockReturnValue(
        '[{"dbId":"abc","sender":"Alice","body":"Hi","timestamp":"","appName":"","rawId":""}]',
      );
      const data = getHistoryData(new Set());
      expect(data.displayedIds.size).toBe(0);
    });

    it('preserves valid entries while filtering invalid ones', () => {
      readFileSyncMock.mockReturnValue(
        '[{"dbId":"ok","sender":"Alice","body":"Hi","unixMs":0,"timestamp":"","appName":"","rawId":""},null,{"sender":"bad"}]',
      );
      const data = getHistoryData(new Set());
      expect(data.displayedIds.size).toBe(1);
      expect(data.displayedIds.has('ok')).toBe(true);
    });
  });

  describe('writeError flag', () => {
    it('sets writeError to true when writeFile throws', async () => {
      writeFileMock.mockRejectedValue(new Error('disk full'));
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();
      expect(getHistoryData(new Set()).writeError).toBe(true);
    });

    it('clears writeError after a subsequent successful write', async () => {
      writeFileMock.mockRejectedValueOnce(new Error('disk full'));
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();
      expect(getHistoryData(new Set()).writeError).toBe(true);

      addDisplayedNotification({ dbId: '2', sender: 'Bob', body: 'World' });
      await flushNotificationHistory();
      expect(getHistoryData(new Set()).writeError).toBe(false);
    });
  });
});

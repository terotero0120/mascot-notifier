import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/mascot-notifier-test'),
  },
}));

const readFileSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();

vi.mock('node:fs', () => ({
  default: {
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
    writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
  },
}));

// Import after mocks are set up.
import { loadSettings, saveSettings } from './settings';

describe('loadSettings', () => {
  beforeEach(() => {
    readFileSyncMock.mockReset();
    writeFileSyncMock.mockReset();
  });

  it('returns defaults when the file does not exist', () => {
    readFileSyncMock.mockImplementation(() => {
      const err = new Error('ENOENT');
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    });
    expect(loadSettings()).toEqual({
      characterFile: 'dance.json',
      displayDuration: 5000,
      displayPosition: 'top-right',
    });
  });

  it('returns defaults when the file contains invalid JSON', () => {
    readFileSyncMock.mockReturnValue('not-json');
    expect(loadSettings()).toEqual({
      characterFile: 'dance.json',
      displayDuration: 5000,
      displayPosition: 'top-right',
    });
  });

  it('merges defaults with the stored values', () => {
    readFileSyncMock.mockReturnValue(JSON.stringify({ displayDuration: 8000 }));
    expect(loadSettings()).toEqual({
      characterFile: 'dance.json',
      displayDuration: 8000,
      displayPosition: 'top-right',
    });
  });

  it('lets stored values override defaults entirely when all fields are set', () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        characterFile: 'crab.json',
        displayDuration: 3000,
        displayPosition: 'bottom-right',
      }),
    );
    expect(loadSettings()).toEqual({
      characterFile: 'crab.json',
      displayDuration: 3000,
      displayPosition: 'bottom-right',
    });
  });
});

describe('saveSettings', () => {
  beforeEach(() => {
    writeFileSyncMock.mockReset();
  });

  it('writes JSON to the settings path', () => {
    saveSettings({
      characterFile: 'dance.json',
      displayDuration: 5000,
      displayPosition: 'top-right',
    });
    expect(writeFileSyncMock).toHaveBeenCalledOnce();
    const [, payload] = writeFileSyncMock.mock.calls[0];
    expect(JSON.parse(payload as string)).toEqual({
      characterFile: 'dance.json',
      displayDuration: 5000,
      displayPosition: 'top-right',
    });
  });
});

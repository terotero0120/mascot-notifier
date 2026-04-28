import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from 'electron';

// File logging (active on Windows or when LOG_TO_FILE env is set)
let logStream: fs.WriteStream | null = null;

function initFileLogging(): void {
  if (!(process.platform === 'win32' || process.env.LOG_TO_FILE)) return;

  try {
    const userDataPath = app.getPath('userData');
    fs.mkdirSync(userDataPath, { recursive: true });
    const logPath = path.join(userDataPath, 'app.log');
    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream = stream;

    stream.on('error', (err) => {
      console.error('File logging disabled:', err);
      logStream = null;
    });

    const timestamp = () => new Date().toISOString();
    const serialize = (args: unknown[]) =>
      args.map((a) => (typeof a === 'string' ? a : inspect(a))).join(' ');
    for (const [method, label] of [
      ['log', 'LOG  '],
      ['warn', 'WARN '],
      ['error', 'ERROR'],
    ] as const) {
      const orig = console[method].bind(console);
      console[method] = (...args: unknown[]) => {
        orig(...args);
        if (logStream) {
          logStream.write(`[${timestamp()}] ${label} ${serialize(args)}\n`);
        }
      };
    }
    console.log('Log file:', logPath);
  } catch (err) {
    console.error('Failed to initialize file logging:', err);
    logStream = null;
  }
}

const IS_E2E = process.env.E2E_TEST === 'true';

if (IS_E2E) {
  const userDataPath =
    process.env.E2E_USERDATA_PATH ?? path.join(os.tmpdir(), `mascot-e2e-${Date.now()}`);
  fs.mkdirSync(userDataPath, { recursive: true });
  app.setPath('userData', userDataPath);
}

if (app.isReady()) {
  initFileLogging();
} else {
  app.whenReady().then(initFileLogging);
}

import { IPC_CHANNELS } from '../shared/ipc-channels';
import type {
  AppSettings,
  NotificationData,
  NotificationHistoryResponse,
  SettingsTab,
} from '../shared/types';
import {
  addDisplayedNotification,
  getHistoryData,
  setWriteErrorCallback,
} from './notificationHistory';
import { type BaseNotificationMonitor, createNotificationMonitor } from './notificationMonitor';
import { loadSettings, saveSettings } from './settings';

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let monitor: BaseNotificationMonitor | null = null;

const MAX_PENDING_NOTIFICATIONS = 50;
const pendingNotifications = new Map<string, NotificationData>();

const preloadPath = path.join(__dirname, '../preload/index.js');
const overlayHtmlPath = path.join(__dirname, '../renderer/overlay.html');
const settingsHtmlPath = path.join(__dirname, '../renderer/settings.html');

function loadOverlay(win: BrowserWindow): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`);
  } else {
    win.loadFile(overlayHtmlPath);
  }
}

function loadSettingsPage(win: BrowserWindow, hash?: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/settings.html${hash ? `#${hash}` : ''}`);
  } else {
    win.loadFile(settingsHtmlPath, hash ? { hash } : undefined);
  }
}

const OVERLAY_WIN_WIDTH = 300;
const OVERLAY_WIN_HEIGHT = 280;
const OVERLAY_MARGIN = 16;

function getOverlayPosition(settings: AppSettings): { x: number; y: number } {
  const { x: workAreaX, y: workAreaY, width, height } = screen.getPrimaryDisplay().workArea;
  const x = workAreaX + width - OVERLAY_WIN_WIDTH - OVERLAY_MARGIN;
  const y =
    settings.displayPosition === 'bottom-right'
      ? workAreaY + height - OVERLAY_WIN_HEIGHT - OVERLAY_MARGIN
      : workAreaY + OVERLAY_MARGIN;
  return { x, y };
}

function createOverlayWindow(): BrowserWindow {
  const settings = loadSettings();
  const { x, y } = getOverlayPosition(settings);

  const win = new BrowserWindow({
    width: OVERLAY_WIN_WIDTH,
    height: OVERLAY_WIN_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  loadOverlay(win);

  return win;
}

function createSettingsWindow(initialTab: SettingsTab = 'settings'): void {
  if (settingsWindow) {
    settingsWindow.webContents.send(IPC_CHANNELS.NAVIGATE_TAB, initialTab);
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadSettingsPage(settingsWindow, initialTab);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray(): void {
  const iconFile = process.platform === 'win32' ? 'icon-win.png' : 'iconTemplate.png';
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../resources', iconFile));
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  tray = new Tray(icon);
  tray.setToolTip('Mascot Notifier');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'テスト通知',
      click: () => {
        overlayWindow?.webContents.send(IPC_CHANNELS.NOTIFICATION, {
          sender: 'テスト送信者',
          body: 'これはテスト通知です！',
          appName: 'Mascot Notifier',
        });
      },
    },
    {
      label: '最新30件を確認',
      click: () => {
        createSettingsWindow('history');
      },
    },
    { type: 'separator' },
    {
      label: '設定',
      click: () => createSettingsWindow(),
    },
    ...(process.platform === 'darwin'
      ? [
          {
            label: '通知設定を開く',
            click: () => {
              shell.openExternal('x-apple.systempreferences:com.apple.Notifications-Settings');
            },
          },
        ]
      : []),
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  overlayWindow = createOverlayWindow();
  createTray();

  setWriteErrorCallback((hasError) => {
    settingsWindow?.webContents.send(IPC_CHANNELS.HISTORY_WRITE_ERROR, hasError);
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => loadSettings());
  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, settings: AppSettings) => {
    const validated = saveSettings(settings);
    overlayWindow?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, validated);
    const { x, y } = getOverlayPosition(validated);
    overlayWindow?.setPosition(x, y);
  });
  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_DISPLAYED, (_event, dbId: string) => {
    const pending = pendingNotifications.get(dbId);
    if (pending) {
      addDisplayedNotification(pending);
      pendingNotifications.delete(dbId);
    }
  });
  ipcMain.handle(
    IPC_CHANNELS.GET_NOTIFICATION_HISTORY,
    async (): Promise<NotificationHistoryResponse> => {
      const dbRecords = monitor ? await monitor.fetchLatest(40) : [];
      const dbIdSet = new Set(dbRecords.map((r) => String(r.id)));

      const { displayedIds, historyOnly, writeError } = getHistoryData(dbIdSet);

      const markedDbRecords = dbRecords.map((r) => ({
        ...r,
        displayedByApp: displayedIds.has(String(r.id)),
      }));

      const historyOnlyRecords = historyOnly.map((e) => ({
        id: Number(e.dbId),
        timestamp: e.timestamp,
        unixMs: e.unixMs,
        sender: e.sender,
        body: e.body,
        appName: e.appName,
        rawId: e.rawId,
        displayedByApp: true as const,
      }));

      return {
        records: [...markedDbRecords, ...historyOnlyRecords]
          .sort((a, b) => b.unixMs - a.unixMs)
          .slice(0, 30),
        writeError,
      };
    },
  );

  if (!IS_E2E || process.env.NOTIFICATION_DB_PATH) {
    monitor = createNotificationMonitor();
    monitor.on('started', () => {
      overlayWindow?.webContents.send(IPC_CHANNELS.NOTIFICATION, {
        sender: 'Mascot Notifier',
        body: '起動しました！通知を監視しています。',
        appName: 'Mascot Notifier',
      });
    });
    monitor.on('notification', (notification) => {
      if (notification.dbId) {
        pendingNotifications.set(notification.dbId, notification);
        if (pendingNotifications.size > MAX_PENDING_NOTIFICATIONS) {
          const oldest = pendingNotifications.keys().next().value;
          if (oldest !== undefined) pendingNotifications.delete(oldest);
        }
      }
      overlayWindow?.webContents.send(IPC_CHANNELS.NOTIFICATION, notification);
    });
    monitor.on('permission-error', async () => {
      if (process.platform === 'darwin') {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: 'フルディスクアクセスが必要です',
          message: 'macOS の通知を取得するために「フルディスクアクセス」権限が必要です。',
          detail: [
            '【必要な理由について】',
            'このアプリは macOS の通知センターのデータベースを読み取ることで、各アプリの通知を検知しています。このデータベースへのアクセスに「フルディスクアクセス」が必要です。',
            '',
            '【安全性について】',
            '• データベースは読み取り専用で開いており、変更・削除は一切行いません',
            '• 通知データを外部に送信することはありません',
            '• アプリはすべてローカルで動作します',
            '',
            '【設定手順】',
            '1. 「システム設定を開く」をクリック',
            '2. 「フルディスクアクセス」の一覧からこのアプリを許可',
            '3. アプリを再起動',
          ].join('\n'),
          buttons: ['システム設定を開く', '後で設定する'],
          defaultId: 0,
        });
        if (response === 0) {
          shell.openExternal(
            'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
          );
        }
      } else if (process.platform === 'win32') {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: '通知アクセスが必要です',
          message: 'Windows の通知を取得するために「通知へのアクセス」権限が必要です。',
          detail: [
            '【設定手順】',
            '1. 「設定を開く」をクリック',
            '2. プライバシーとセキュリティ → 通知',
            '3. このアプリの通知アクセスを許可',
            '4. アプリを再起動',
          ].join('\n'),
          buttons: ['設定を開く', '後で設定する'],
          defaultId: 0,
        });
        if (response === 0) {
          shell.openExternal('ms-settings:privacy-notifications');
        }
      }
    });
    monitor.start();
  }

  if (process.argv.includes('--open-settings')) {
    createSettingsWindow();
  }
});

app.on('window-all-closed', () => {
  // keep running
});

app.on('before-quit', () => {
  monitor?.stop();
  logStream?.end();
});

import fs from 'node:fs';
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

if (app.isReady()) {
  initFileLogging();
} else {
  app.whenReady().then(initFileLogging);
}

import { type BaseNotificationMonitor, createNotificationMonitor } from './notificationMonitor';
import { type AppSettings, loadSettings, saveSettings } from './settings';

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let monitor: BaseNotificationMonitor | null = null;

const preloadPath = path.join(__dirname, '../preload/index.js');
const rendererHtmlPath = path.join(__dirname, '../renderer/index.html');

function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hash ? `#${hash}` : ''}`);
  } else {
    win.loadFile(rendererHtmlPath, hash ? { hash } : undefined);
  }
}

function getOverlayPosition(settings: AppSettings): { x: number; y: number } {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const winWidth = 300;
  const winHeight = 280;
  const x = width - winWidth - 16;
  const y = settings.displayPosition === 'bottom-right' ? height - winHeight - 16 : 16;
  return { x, y };
}

function createOverlayWindow(): BrowserWindow {
  const settings = loadSettings();
  const { x, y } = getOverlayPosition(settings);

  const winWidth = 300;
  const winHeight = 280;

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
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

  loadRenderer(win);

  return win;
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 430,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(settingsWindow, 'settings');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

async function handleFetchLatest(): Promise<void> {
  if (!monitor) {
    await dialog.showMessageBox({
      type: 'info',
      title: '最新10件を確認',
      message: 'モニターが初期化されていません。',
      buttons: ['OK'],
    });
    return;
  }

  try {
    const records = await monitor.fetchLatest(10);

    if (records.length === 0) {
      await dialog.showMessageBox({
        type: 'info',
        title: '最新10件を確認',
        message: '通知が見つかりませんでした。',
        detail: 'データベースに通知が存在しないか、まだ記録されていません。',
        buttons: ['閉じる'],
      });
      return;
    }

    const lines = records.map((r, i) => {
      const num = String(i + 1).padStart(2, ' ');
      const senderPart = r.sender !== r.appName ? ` - ${r.sender}` : '';
      return `${num}. [${r.timestamp}] ${r.appName}${senderPart}\n    ${r.body}\n    (ID: ${r.id}, ${r.rawId})`;
    });

    await dialog.showMessageBox({
      type: 'info',
      title: `最新${records.length}件の通知`,
      message: `データベースから取得した最新${records.length}件（新しい順）`,
      detail: lines.join('\n\n'),
      buttons: ['閉じる'],
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? '';
    const message = (err as Error).message ?? '';
    const isPermission =
      code === 'ENOENT' ||
      code === 'EACCES' ||
      code === 'SQLITE_CANTOPEN' ||
      message.includes('unable to open database') ||
      message.includes('directory does not exist');

    await dialog.showMessageBox({
      type: 'warning',
      title: '最新10件を確認 - エラー',
      message: isPermission
        ? 'データベースにアクセスできませんでした。'
        : '通知の取得中にエラーが発生しました。',
      detail: isPermission ? 'フルディスクアクセス権限が必要な場合があります。' : message,
      buttons: ['OK'],
    });
  }
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
        overlayWindow?.webContents.send('notification', {
          sender: 'テスト送信者',
          body: 'これはテスト通知です！',
          appName: 'Mascot Notifier',
        });
      },
    },
    {
      label: '最新10件を確認',
      click: () => {
        void handleFetchLatest();
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

  ipcMain.handle('get-settings', () => loadSettings());
  ipcMain.handle('save-settings', (_event, settings: AppSettings) => {
    saveSettings(settings);
    overlayWindow?.webContents.send('settings-changed', settings);
    const { x, y } = getOverlayPosition(settings);
    overlayWindow?.setPosition(x, y);
  });

  monitor = createNotificationMonitor();
  monitor.on('started', () => {
    overlayWindow?.webContents.send('notification', {
      sender: 'Mascot Notifier',
      body: '起動しました！通知を監視しています。',
      appName: 'Mascot Notifier',
    });
  });
  monitor.on('notification', (notification) => {
    overlayWindow?.webContents.send('notification', notification);
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
});

app.on('window-all-closed', () => {
  // keep running
});

app.on('before-quit', () => {
  monitor?.stop();
  logStream?.end();
});

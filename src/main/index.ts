import { app, BrowserWindow, screen, Tray, Menu, nativeImage, dialog, shell, ipcMain } from 'electron'
import path from 'path'
import { NotificationMonitor } from './notificationMonitor'
import { loadSettings, saveSettings } from './settings'

let overlayWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let monitor: NotificationMonitor | null = null

const preloadPath = path.join(__dirname, '../preload/index.js')
const rendererHtmlPath = path.join(__dirname, '../renderer/index.html')

function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hash ? '#' + hash : ''}`)
  } else {
    win.loadFile(rendererHtmlPath, hash ? { hash } : undefined)
  }
}

function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize

  const winWidth = 300
  const winHeight = 280

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: width - winWidth - 16,
    y: 16,
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
      nodeIntegration: false
    }
  })

  win.setIgnoreMouseEvents(true, { forward: true })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadRenderer(win)

  return win
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 360,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  loadRenderer(settingsWindow, 'settings')

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setTitle('🐱')
  tray.setToolTip('Mascot Notifier')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'テスト通知',
      click: () => {
        overlayWindow?.webContents.send('notification', {
          sender: 'テスト送信者',
          body: 'これはテスト通知です！'
        })
      }
    },
    { type: 'separator' },
    {
      label: '設定',
      click: () => createSettingsWindow()
    },
    {
      label: '通知設定を開く',
      click: () => {
        shell.openExternal('x-apple.systempreferences:com.apple.Notifications-Settings')
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

app.whenReady().then(() => {
  overlayWindow = createOverlayWindow()
  createTray()

  ipcMain.handle('get-settings', () => loadSettings())
  ipcMain.handle('save-settings', (_event, settings) => {
    saveSettings(settings)
    overlayWindow?.webContents.send('settings-changed', settings)
  })

  monitor = new NotificationMonitor()
  monitor.on('started', () => {
    overlayWindow?.webContents.send('notification', {
      sender: 'Mascot Notifier',
      body: '起動しました！通知を監視しています。'
    })
  })
  monitor.on('notification', (notification) => {
    overlayWindow?.webContents.send('notification', notification)
  })
  monitor.on('permission-error', async () => {
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
        '3. アプリを再起動'
      ].join('\n'),
      buttons: ['システム設定を開く', '後で設定する'],
      defaultId: 0
    })
    if (response === 0) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')
    }
  })
  monitor.start()
})

app.on('window-all-closed', () => {
  // keep running
})

app.on('before-quit', () => {
  monitor?.stop()
})

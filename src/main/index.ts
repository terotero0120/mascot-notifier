import { app, BrowserWindow, screen, Tray, Menu, nativeImage, dialog, shell } from 'electron'
import path from 'path'
import { NotificationMonitor } from './notificationMonitor'

let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let monitor: NotificationMonitor | null = null

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
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setIgnoreMouseEvents(true, { forward: true })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

function createTray(): void {
  // Create a 1x1 transparent PNG as placeholder (macOS shows title text)
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

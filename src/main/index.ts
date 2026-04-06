import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { NotificationMonitor } from './notificationMonitor'

let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let monitor: NotificationMonitor | null = null

function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize

  const winWidth = 360
  const winHeight = 200

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
  monitor.on('notification', (notification) => {
    overlayWindow?.webContents.send('notification', notification)
  })
  monitor.start()
})

app.on('window-all-closed', () => {
  // keep running
})

app.on('before-quit', () => {
  monitor?.stop()
})

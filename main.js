const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { rolloverTasks } = require('./src/tasks');

const DATA_FILE = path.join(app.getPath('userData'), 'tasks.json');

let win = null;
let tray = null;
let isQuitting = false;
let notificationSent = false;

function sendDueNotification(tasks, today) {
  if (!Notification.isSupported()) return;
  const dueToday = tasks.filter(t => !t.completed && t.dueDate === today);
  const overdue  = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < today);
  if (dueToday.length === 0 && overdue.length === 0) return;
  const parts = [];
  if (dueToday.length) parts.push(`${dueToday.length} due today`);
  if (overdue.length)  parts.push(`${overdue.length} overdue`);
  new Notification({
    title: 'Work Tasks',
    body: parts.join(' · '),
    icon: path.join(__dirname, 'build', 'icon.ico'),
  }).show();
}

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Work Tasks',
    backgroundColor: '#1e1e1e',
  });
  win.loadFile('index.html');

  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('Work Tasks');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { win.show(); win.focus(); });

  win.on('close', e => {
    if (!isQuitting) { e.preventDefault(); win.hide(); }
  });
}

ipcMain.handle('tasks:read', () => {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    const rolled = rolloverTasks(raw, today);
    if (rolled.some((t, i) => t.category !== raw[i].category)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(rolled, null, 2));
    }
    if (!notificationSent) {
      notificationSent = true;
      sendDueNotification(rolled, today);
    }
    return rolled;
  } catch {
    return [];
  }
});

ipcMain.handle('tasks:write', (_, tasks) => {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

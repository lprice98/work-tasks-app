const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { rolloverTasks } = require('./src/tasks');

const DATA_FILE = path.join(app.getPath('userData'), 'tasks.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const HABITS_FILE = path.join(app.getPath('userData'), 'habits.json');

let win = null;
let tray = null;
let isQuitting = false;
let notificationSent = false;
let lastDailyNotificationDate = '';

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveSettings(data) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2)); } catch {}
}

function loadHabits() {
  try {
    if (fs.existsSync(HABITS_FILE)) return JSON.parse(fs.readFileSync(HABITS_FILE, 'utf8'));
  } catch {}
  return [];
}

function saveHabits(habits) {
  try { fs.writeFileSync(HABITS_FILE, JSON.stringify(habits, null, 2)); } catch {}
}

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
  const settings = loadSettings();
  const bounds = settings.windowBounds || {};

  win = new BrowserWindow({
    width: bounds.width || 900,
    height: bounds.height || 700,
    x: bounds.x,
    y: bounds.y,
    minWidth: 600,
    minHeight: 400,
    frame: false,
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
  const trayIcon = nativeImage.createFromPath(iconPath);
  if (!trayIcon.isEmpty()) {
    tray = new Tray(trayIcon);
    tray.setToolTip('Work Tasks');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
    ]));
    tray.on('double-click', () => { win.show(); win.focus(); });
  }

  win.on('close', e => {
    const s = loadSettings();
    saveSettings({ ...s, windowBounds: win.getBounds() });
    if (!isQuitting) { e.preventDefault(); win.hide(); }
  });

  win.on('maximize', () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));

  // Daily notification check every hour
  setInterval(() => {
    const s = loadSettings();
    if (s.notifyEnabled === false) return;
    const today = new Date().toISOString().slice(0, 10);
    if (lastDailyNotificationDate === today) return;
    const notifyHour = s.notifyHour ?? 9;
    if (new Date().getHours() < notifyHour) return;
    if (!fs.existsSync(DATA_FILE)) return;
    try {
      const tasks = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      sendDueNotification(tasks, today);
      lastDailyNotificationDate = today;
    } catch {}
  }, 60 * 60 * 1000);
}

ipcMain.handle('tasks:read', () => {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    const settings = loadSettings();
    const autoRollover = settings.autoRollover !== false;
    const rolled = autoRollover ? rolloverTasks(raw, today) : raw;
    if (autoRollover && rolled.some((t, i) => t.category !== raw[i].category)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(rolled, null, 2));
    }
    if (!notificationSent && settings.notifyEnabled !== false) {
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

ipcMain.handle('settings:read', () => loadSettings());

ipcMain.handle('settings:write', (_, incoming) => {
  const current = loadSettings();
  saveSettings({ ...current, ...incoming });
});

ipcMain.handle('habits:read', () => loadHabits());
ipcMain.handle('habits:write', (_, habits) => saveHabits(habits));

ipcMain.handle('tasks:exportExcel', async (_, tasks) => {
  const today = new Date().toISOString().slice(0, 10);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Export Tasks to Excel',
    defaultPath: `tasks-${today}.xlsx`,
    filters: [{ name: 'Excel File', extensions: ['xlsx'] }],
  });
  if (canceled || !filePath) return { cancelled: true };

  try {
    const XLSX = require('xlsx');
    const categories = ['today', 'thisweek', 'backlog', 'upcoming'];
    const catLabels = { today: 'Today', thisweek: 'This Week', backlog: 'Backlog', upcoming: 'Upcoming' };
    const wb = XLSX.utils.book_new();

    // All tasks sheet
    const allRows = tasks.map(t => ({
      Title: t.title,
      Category: catLabels[t.category] || t.category,
      Priority: t.priority,
      'Due Date': t.dueDate || '',
      Status: t.completed ? 'Done' : 'Active',
      Tags: (t.tags || []).join(', '),
      Notes: t.notes || '',
      'Est. (min)': t.estimate || '',
      'Completed At': t.completedAt ? t.completedAt.slice(0, 10) : '',
      Created: t.createdAt ? t.createdAt.slice(0, 10) : '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows), 'All Tasks');

    // Per-category sheets
    for (const cat of categories) {
      const rows = tasks.filter(t => t.category === cat).map(t => ({
        Title: t.title,
        Priority: t.priority,
        'Due Date': t.dueDate || '',
        Status: t.completed ? 'Done' : 'Active',
        Tags: (t.tags || []).join(', '),
        Notes: t.notes || '',
        'Est. (min)': t.estimate || '',
      }));
      if (rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), catLabels[cat]);
    }

    XLSX.writeFile(wb, filePath);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('tasks:import', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Import Tasks',
    filters: [
      { name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { cancelled: true };

  try {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(filePaths[0]);
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    return { rows };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('window:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('window:maximize', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle('window:close', () => {
  if (!win) return;
  const s = loadSettings();
  saveSettings({ ...s, windowBounds: win.getBounds() });
  win.hide();
});

ipcMain.handle('tasks:export', async (_, content) => {
  const today = new Date().toISOString().slice(0, 10);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Export Tasks',
    defaultPath: `tasks-${today}.txt`,
    filters: [{ name: 'Text File', extensions: ['txt'] }],
  });
  if (canceled || !filePath) return { cancelled: true };
  fs.writeFileSync(filePath, content, 'utf8');
  return { success: true };
});

ipcMain.handle('app:getAutoStart', () => {
  try { return app.getLoginItemSettings().openAtLogin; } catch { return false; }
});

ipcMain.handle('app:setAutoStart', (_, enable) => {
  try { app.setLoginItemSettings({ openAtLogin: enable }); } catch {}
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}

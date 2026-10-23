const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { rolloverTasks } = require('./src/tasks');

const DATA_FILE = path.join(app.getPath('userData'), 'tasks.json');

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createWindow() {
  const win = new BrowserWindow({
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

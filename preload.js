const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskAPI', {
  readTasks: () => ipcRenderer.invoke('tasks:read'),
  writeTasks: (tasks) => ipcRenderer.invoke('tasks:write', tasks),
  getAutoStart: () => ipcRenderer.invoke('app:getAutoStart'),
  setAutoStart: (enable) => ipcRenderer.invoke('app:setAutoStart', enable),
  exportTasks: (content) => ipcRenderer.invoke('tasks:export', content),
  exportExcel: (tasks) => ipcRenderer.invoke('tasks:exportExcel', tasks),
  importTasks: () => ipcRenderer.invoke('tasks:import'),
  readSettings: () => ipcRenderer.invoke('settings:read'),
  writeSettings: (s) => ipcRenderer.invoke('settings:write', s),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  onMaximized: (cb) => ipcRenderer.on('window:maximized', (_, isMax) => cb(isMax)),
  readHabits: () => ipcRenderer.invoke('habits:read'),
  writeHabits: (habits) => ipcRenderer.invoke('habits:write', habits),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  onUpdateReady: (cb) => ipcRenderer.on('update:ready', cb),
});

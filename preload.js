const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskAPI', {
  readTasks: () => ipcRenderer.invoke('tasks:read'),
  writeTasks: (tasks) => ipcRenderer.invoke('tasks:write', tasks),
});
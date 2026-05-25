const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  startProjection: (displayId) => ipcRenderer.send('start-projection', displayId),
  stopProjection: () => ipcRenderer.send('stop-projection'),
  updateLyrics: (data) => ipcRenderer.send('update-lyrics', data),
  getSources: () => ipcRenderer.invoke('get-sources'),
  shareSource: (sourceId) => ipcRenderer.send('share-source', sourceId),
  stopShare: () => ipcRenderer.send('stop-share'),
  isProjectionActive: () => ipcRenderer.invoke('is-projection-active'),

  onProjectionClosed: (callback) => ipcRenderer.on('projection-closed', callback),
  onUpdateLyrics: (callback) => ipcRenderer.on('update-lyrics', callback),
  onShareSource: (callback) => ipcRenderer.on('share-source', callback),
  onStopShare: (callback) => ipcRenderer.on('stop-share', callback),
  onNextSlide: (callback) => ipcRenderer.on('next-slide', callback),
  onPrevSlide: (callback) => ipcRenderer.on('prev-slide', callback),

  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },

  openExternalDisplay: (config) => ipcRenderer.send('open-external-display', config),
  closeExternalDisplay: () => ipcRenderer.send('close-external-display'),
  sendToDisplays: (message) => ipcRenderer.send('send-to-displays', message),
  sendToDisplay: (displayType, message) => ipcRenderer.send('send-to-display', displayType, message),
  sendToMain: (message) => ipcRenderer.send('send-to-main', message),

  onDisplayMessage: (callback) => ipcRenderer.on('display-message', callback),
  removeDisplayMessageListener: (callback) => ipcRenderer.removeListener('display-message', callback),

  onMainMessage: (callback) => ipcRenderer.on('main-message', callback),
  removeMainMessageListener: (callback) => ipcRenderer.removeListener('main-message', callback),

  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // 文件对话框
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  copyFileToAppData: (sourcePath, targetFolder) => ipcRenderer.invoke('copy-file-to-app-data', sourcePath, targetFolder),

  // 工具更新（新的简化方式）
  updateTool: (data) => ipcRenderer.send('update-tool', data),
  onToolUpdate: (callback) => ipcRenderer.on('tool-update', callback),

  // 保留旧的API以兼容
  showNotification: (data) => ipcRenderer.send('show-notification', data),
  hideNotification: () => ipcRenderer.send('hide-notification'),
  onNotificationData: (callback) => ipcRenderer.on('notification-data', callback),
  removeNotificationDataListener: (callback) => ipcRenderer.removeListener('notification-data', callback),

  showCountdown: (data) => ipcRenderer.send('show-countdown', data),
  hideCountdown: () => ipcRenderer.send('hide-countdown'),
  onCountdownData: (callback) => ipcRenderer.on('countdown-data', callback),
  removeCountdownDataListener: (callback) => ipcRenderer.removeListener('countdown-data', callback),

  showClock: () => ipcRenderer.send('show-clock'),
  hideClock: () => ipcRenderer.send('hide-clock'),
  onClockData: (callback) => ipcRenderer.on('clock-data', callback),
  removeClockDataListener: (callback) => ipcRenderer.removeListener('clock-data', callback),

  // Logging & error reporting
  logError: (errorInfo) => ipcRenderer.invoke('log-error', errorInfo),
  logEvent: (eventInfo) => ipcRenderer.invoke('log-event', eventInfo),

  // Open external links
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Auto-updates
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onAppError: (callback) => ipcRenderer.on('app-error', callback),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
});

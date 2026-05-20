// Electron IPC wrapper for React
// 使用 contextBridge 安全暴露的 API，符合 Electron 最佳安全实践

const electronAPI = {
  // 获取所有显示器
  getDisplays: () => {
    return window.electronAPI.getDisplays();
  },

  // 开始投影到指定显示器
  startProjection: (displayId) => {
    window.electronAPI.startProjection(displayId);
  },

  // 停止投影
  stopProjection: () => {
    window.electronAPI.stopProjection();
  },

  // 更新歌词到投影窗口
  updateLyrics: (data) => {
    window.electronAPI.updateLyrics(data);
  },

  // 检查投影是否激活
  isProjectionActive: () => {
    return window.electronAPI.isProjectionActive();
  },

  // 监听投影窗口关闭
  onProjectionClosed: (callback) => {
    window.electronAPI.onProjectionClosed(callback);
    return () => window.electronAPI.removeListener('projection-closed', callback);
  },

  // 监听上一页/下一页（从投影窗口遥控）
  onNextSlide: (callback) => {
    // 需要在主进程添加这些事件监听
    const wrappedCallback = (event, ...args) => callback(...args);
    // 先绑定后返回清理函数
    if (window.electronAPI.onNextSlide) {
      window.electronAPI.onNextSlide(wrappedCallback);
      return () => window.electronAPI.removeListener('next-slide', wrappedCallback);
    }
    return () => {};
  },

  onPrevSlide: (callback) => {
    const wrappedCallback = (event, ...args) => callback(...args);
    if (window.electronAPI.onPrevSlide) {
      window.electronAPI.onPrevSlide(wrappedCallback);
      return () => window.electronAPI.removeListener('prev-slide', wrappedCallback);
    }
    return () => {};
  },

  // 窗口分享相关
  getSources: () => {
    return window.electronAPI.getSources();
  },

  shareSource: (sourceId) => {
    window.electronAPI.shareSource(sourceId);
  },

  stopShare: () => {
    window.electronAPI.stopShare();
  },

  getCurrentShareSource: () => {
    if (window.electronAPI.getCurrentShareSource) {
      return window.electronAPI.getCurrentShareSource();
    }
    return null;
  },

  // 文件对话框
  openFileDialog: (options) => {
    if (window.electronAPI.openFileDialog) {
      return window.electronAPI.openFileDialog(options);
    }
    return Promise.resolve({ canceled: true, filePaths: [] });
  },

  // 读取文件
  readFile: (filePath) => {
    if (window.electronAPI.readFile) {
      return window.electronAPI.readFile(filePath);
    }
    return Promise.resolve({ success: false, error: 'Not available' });
  },

  // 复制文件到 app data 目录
  copyFileToAppData: (sourcePath, targetFolder) => {
    if (window.electronAPI.copyFileToAppData) {
      return window.electronAPI.copyFileToAppData(sourcePath, targetFolder);
    }
    return Promise.resolve({ success: false, error: 'Not available' });
  },

  // 通知显示
  showNotification: (data) => {
    if (window.electronAPI.showNotification) {
      window.electronAPI.showNotification(data);
    }
  },

  hideNotification: () => {
    if (window.electronAPI.hideNotification) {
      window.electronAPI.hideNotification();
    }
  },

  // 倒计时
  showCountdown: (data) => {
    if (window.electronAPI.showCountdown) {
      window.electronAPI.showCountdown(data);
    }
  },

  hideCountdown: () => {
    if (window.electronAPI.hideCountdown) {
      window.electronAPI.hideCountdown();
    }
  },

  // 时钟
  showClock: () => {
    if (window.electronAPI.showClock) {
      window.electronAPI.showClock();
    }
  },

  hideClock: () => {
    if (window.electronAPI.hideClock) {
      window.electronAPI.hideClock();
    }
  },

  // 工具更新（新API）
  updateTool: (data) => {
    if (window.electronAPI.updateTool) {
      window.electronAPI.updateTool(data);
    }
  },
};

export default electronAPI;

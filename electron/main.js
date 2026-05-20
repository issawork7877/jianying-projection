const { app, BrowserWindow, ipcMain, screen, desktopCapturer, Menu, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let projectionWindow = null;
let externalDisplay = null;
let liveDisplay = null;
let stageDisplay = null;
let lastProjectionData = null;

let isExternalOpen = false;
let externalDisplayIndex = 0;
let liveDisplayIndex = -1;
let stageDisplayIndex = -1;

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      webSecurity: false,
    },
    title: '简影投屏',
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeAllWindows();
    app.quit();
  });

  setupMainMenu();
}

function setupMainMenu() {
  if (process.platform === 'darwin') {
    const template = [
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'delete', label: '删除' },
          { role: 'selectall', label: '全选' },
        ],
      },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    Menu.setApplicationMenu(null);
  }
}

function createProjectionWindow(displayId) {
  const displays = screen.getAllDisplays();
  let targetDisplay = null;

  if (displayId !== null && displayId !== undefined) {
    targetDisplay = displays.find(d => d.id === displayId);
  } else {
    targetDisplay = displays.length > 1 ? displays[1] : null;
  }

  const options = {
    fullscreen: true,
    show: true, // 立即显示
    frame: false,
    autoHideMenuBar: true,
    skipTaskbar: true,
    backgroundColor: '#323341', // 设置背景色避免白屏
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  };

  if (targetDisplay) {
    options.x = targetDisplay.bounds.x;
    options.y = targetDisplay.bounds.y;
    options.width = targetDisplay.bounds.width;
    options.height = targetDisplay.bounds.height;
  } else {
    options.fullscreen = true;
  }

  // 如果之前有窗口，先关闭
  if (projectionWindow) {
    try {
      projectionWindow.close();
    } catch (e) {}
  }

  projectionWindow = new BrowserWindow(options);

  // 开发模式下打开开发者工具
  if (isDev) {
    projectionWindow.webContents.openDevTools();
  }

  const projectionUrl = isDev
    ? `${VITE_DEV_SERVER_URL}#/projection`
    : `file://${path.join(__dirname, '../dist/index.html')}#/projection`;

  projectionWindow.loadURL(projectionUrl);
  projectionWindow.setAlwaysOnTop(true);

  // 双重保险：dom-ready 和 did-finish-load 都发数据
  const sendData = () => {
    if (lastProjectionData && projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.webContents.send('update-lyrics', lastProjectionData);
    }
  };

  projectionWindow.webContents.once('dom-ready', sendData);
  projectionWindow.webContents.once('did-finish-load', sendData);

  // 当投影窗口获得焦点时，自动把焦点还给主窗口
  projectionWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });

  projectionWindow.on('closed', () => {
    projectionWindow = null;
    if (mainWindow) {
      mainWindow.webContents.send('projection-closed');
    }
  });
}


function createExternalDisplay(displayConfig = {}) {
  const displays = screen.getAllDisplays();

  if (displays.length <= 1) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const size = primaryDisplay.workAreaSize;
    const aspectRatio = displayConfig.screenSizeType === 10 ? 16 / 9 : 4 / 3;

    let width = Math.min(size.width * 0.8, 1920);
    let height = width / aspectRatio;

    if (height > size.height * 0.8) {
      height = size.height * 0.8;
      width = height * aspectRatio;
    }

    externalDisplay = new BrowserWindow({
      width: Math.floor(width),
      height: Math.floor(height),
      frame: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js'),
        webSecurity: false,
      },
      backgroundColor: '#1a1a1a',
    });
  } else {
    let targetIndex = displays.length - 1;
    if (displayConfig.displayIndex >= 0 && displays[displayConfig.displayIndex]) {
      targetIndex = displayConfig.displayIndex;
    } else {
      const primary = screen.getPrimaryDisplay();
      for (let i = 0; i < displays.length; i++) {
        if (primary.id === displays[i].id && i === 0) {
          targetIndex = displays.length - 1;
          break;
        }
      }
    }

    externalDisplayIndex = targetIndex;
    const targetDisplay = displays[targetIndex];

    externalDisplay = new BrowserWindow({
      width: targetDisplay.size.width,
      height: targetDisplay.size.height,
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      frame: false,
      fullscreen: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js'),
        webSecurity: false,
      },
      backgroundColor: '#1a1a1a',
    });

    if (displayConfig.liveIndex >= 0 && displays[displayConfig.liveIndex]) {
      createLiveDisplay(displays[displayConfig.liveIndex]);
    }

    if (displayConfig.stageIndex >= 0 && displays[displayConfig.stageIndex]) {
      createStageDisplay(displays[displayConfig.stageIndex]);
    }
  }

  const displayUrl = isDev
    ? `${VITE_DEV_SERVER_URL}#/external`
    : `file://${path.join(__dirname, '../dist/index.html')}#/external`;

  externalDisplay.loadURL(displayUrl);

  externalDisplay.on('closed', () => {
    externalDisplay = null;
    isExternalOpen = false;
    if (mainWindow) {
      mainWindow.webContents.send('display-closed');
    }
  });

  isExternalOpen = true;
}

function createLiveDisplay(displayInfo) {
  liveDisplayIndex = displayInfo.id;

  liveDisplay = new BrowserWindow({
    width: displayInfo.size.width,
    height: displayInfo.size.height,
    x: displayInfo.bounds.x,
    y: displayInfo.bounds.y,
    frame: false,
    autoHideMenuBar: true,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      webSecurity: false,
    },
  });

  const liveUrl = isDev
    ? `${VITE_DEV_SERVER_URL}#/live`
    : `file://${path.join(__dirname, '../dist/index.html')}#/live`;

  liveDisplay.loadURL(liveUrl);

  if (isDev) {
    liveDisplay.webContents.openDevTools();
  }
}

function createStageDisplay(displayInfo) {
  stageDisplayIndex = displayInfo.id;

  stageDisplay = new BrowserWindow({
    width: displayInfo.size.width,
    height: displayInfo.size.height,
    x: displayInfo.bounds.x,
    y: displayInfo.bounds.y,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      webSecurity: false,
    },
    backgroundColor: '#0d1117',
  });

  const stageUrl = isDev
    ? `${VITE_DEV_SERVER_URL}#/stage`
    : `file://${path.join(__dirname, '../dist/index.html')}#/stage`;

  stageDisplay.loadURL(stageUrl);

  if (isDev) {
    stageDisplay.webContents.openDevTools();
  }
}

function closeExternalDisplay() {
  if (externalDisplay) {
    try {
      externalDisplay.close();
    } catch (e) {}
    externalDisplay = null;
  }

  if (liveDisplay) {
    try {
      liveDisplay.close();
    } catch (e) {}
    liveDisplay = null;
    liveDisplayIndex = -1;
  }

  if (stageDisplay) {
    try {
      stageDisplay.close();
    } catch (e) {}
    stageDisplay = null;
    stageDisplayIndex = -1;
  }

  isExternalOpen = false;
}

function closeAllWindows() {
  closeExternalDisplay();
  if (projectionWindow) {
    try {
      projectionWindow.close();
    } catch (e) {}
    projectionWindow = null;
  }
}

function sendToDisplays(message) {
  if (projectionWindow) {
    projectionWindow.webContents.send('display-message', message);
  }
  if (externalDisplay) {
    externalDisplay.webContents.send('display-message', message);
  }
  if (liveDisplay) {
    liveDisplay.webContents.send('display-message', message);
  }
  if (stageDisplay) {
    stageDisplay.webContents.send('display-message', message);
  }
}

function sendToSpecificDisplay(displayType, message) {
  const targetWindow = {
    projection: projectionWindow,
    external: externalDisplay,
    live: liveDisplay,
    stage: stageDisplay,
  }[displayType];

  if (targetWindow) {
    targetWindow.webContents.send('display-message', message);
  }
}

// 向投影窗口发送工具更新
function sendToolUpdate(data) {
  if (projectionWindow) {
    projectionWindow.webContents.send('tool-update', data);
  }
}

app.whenReady().then(() => {
  // 注册自定义协议来安全地加载本地文件
  protocol.registerFileProtocol('local-file', (request, callback) => {
    let filePath = request.url.replace('local-file://', '');
    // 解码 URL 编码的字符
    try {
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      // 如果解码失败，使用原始路径
    }
    callback({ path: filePath });
  });

  createMainWindow();

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label,
      isPrimary: d.id === screen.getPrimaryDisplay().id,
      width: d.bounds.width,
      height: d.bounds.height,
    }));
  });

  ipcMain.handle('get-sources', async () => {
    try {
      if (process.platform === 'darwin') {
        const { systemPreferences } = require('electron');

        try {
          const sources = await desktopCapturer.getSources({
            types: ['window', 'screen'],
            thumbnailSize: { width: 320, height: 240 }
          });

          if (sources.length === 0) {
            const status = systemPreferences.getMediaAccessStatus('screen');

            if (status !== 'granted') {
              return [
                {
                  id: 'permission-needed',
                  name: '⚠️ 请开启屏幕录制权限',
                  thumbnail: null,
                  isPermission: true
                },
              ];
            }
          }

          return sources.map(source => ({
            id: source.id,
            name: source.name,
            thumbnail: source.thumbnail.toDataURL()
          }));
        } catch (permError) {
          console.error('Permission error:', permError);

          try {
            const status = systemPreferences.getMediaAccessStatus('screen');

            return [
              {
                id: 'permission-needed',
                name: '⚠️ 请先开启屏幕录制权限',
                thumbnail: null,
                isPermission: true
              },
            ];
          } catch (e) {
            console.error('Error checking permission:', e);
          }
        }
      }

      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 320, height: 240 }
      });
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
      }));
    } catch (error) {
      console.error('Error getting sources:', error);
      return [
        {
          id: 'error',
          name: '❌ 获取源失败，请检查权限',
          thumbnail: null,
          isError: true
        },
      ];
    }
  });

  ipcMain.on('start-projection', (event, displayId) => {
    createProjectionWindow(displayId);
  });

  ipcMain.on('stop-projection', () => {
    if (projectionWindow) {
      projectionWindow.close();
      projectionWindow = null;
    }
  });

  ipcMain.on('update-lyrics', (event, data) => {
    lastProjectionData = data;
    if (projectionWindow) {
      projectionWindow.webContents.send('update-lyrics', data);
    }
    const displayMessage = {
      type: 'update-content',
      song: data.song,
      slideIndex: data.slideIndex,
      theme: data.theme,
      background: data.background
    };
    sendToDisplays(displayMessage);
  });

  ipcMain.on('share-source', (event, sourceId) => {
    if (projectionWindow) {
      projectionWindow.webContents.send('share-source', sourceId);
    }
    sendToDisplays({ type: 'start-share', sourceId: sourceId });
  });

  ipcMain.on('stop-share', () => {
    if (projectionWindow) {
      projectionWindow.webContents.send('stop-share');
    }
    sendToDisplays({ type: 'stop-share' });
  });

  ipcMain.handle('is-projection-active', () => {
    return projectionWindow !== null && !projectionWindow.isDestroyed();
  });

  ipcMain.on('open-external-display', (_, config) => {
    if (!isExternalOpen) {
      createExternalDisplay(config);
    }
  });

  ipcMain.on('close-external-display', () => {
    closeExternalDisplay();
  });

  ipcMain.on('send-to-displays', (_, message) => {
    sendToDisplays(message);
  });

  ipcMain.on('send-to-display', (_, displayType, message) => {
    sendToSpecificDisplay(displayType, message);
  });

  ipcMain.on('send-to-main', (_, message) => {
    if (mainWindow) {
      mainWindow.webContents.send('main-message', message);
    }
  });

  ipcMain.handle('get-app-path', () => {
    return {
      appData: app.getPath('appData'),
      userData: app.getPath('userData'),
      documents: app.getPath('documents'),
    };
  });

  ipcMain.handle('open-file-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options || {});
    return result;
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('copy-file-to-app-data', async (event, sourcePath, targetFolder) => {
    try {
      const userDataPath = app.getPath('userData');
      const targetDir = path.join(userDataPath, targetFolder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileName = path.basename(sourcePath);
      const uniqueFileName = Date.now() + '_' + fileName;
      const targetPath = path.join(targetDir, uniqueFileName);

      fs.copyFileSync(sourcePath, targetPath);

      return { success: true, targetPath };
    } catch (error) {
      console.error('Copy file error:', error);
      return { success: false, error: error.message };
    }
  });

  // 工具更新 - 直接发送到投影窗口
  ipcMain.on('update-tool', (event, data) => {
    sendToolUpdate(data);
  });

  // 保留旧的API以兼容
  ipcMain.on('show-notification', (event, data) => {
    sendToolUpdate({ ...data, show: true, type: 'notification' });
  });

  ipcMain.on('hide-notification', () => {
    sendToolUpdate({ show: false, type: 'notification' });
  });

  ipcMain.on('show-countdown', (event, data) => {
    sendToolUpdate({ ...data, show: true, type: 'countdown' });
  });

  ipcMain.on('hide-countdown', () => {
    sendToolUpdate({ show: false, type: 'countdown' });
  });

  ipcMain.on('show-clock', () => {
    sendToolUpdate({ show: true, type: 'clock' });
  });

  ipcMain.on('hide-clock', () => {
    sendToolUpdate({ show: false, type: 'clock' });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-web-security');

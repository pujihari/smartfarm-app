const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let angularProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js'),
      // Enable loading local files
      webSecurity: false
    }
  });

  // Load the Angular app
  if (process.env.NODE_ENV === 'development') {
    // In development, load from the Angular dev server
    mainWindow.loadURL('http://localhost:4200');
    
    // Open dev tools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built Angular app
    mainWindow.loadFile(path.join(__dirname, 'dist/smartfarm-app/browser/index.html'));
  }

  // Handle external links (open in default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Auto-update functionality
function sendStatusToWindow(text) {
  if (mainWindow) {
    mainWindow.webContents.send('message', text);
  }
}

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. The update will be downloaded in the background.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
});

autoUpdater.on('error', (err) => {
  sendStatusToWindow('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  sendStatusToWindow(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. Restart the application to apply the updates.',
    buttons: ['Restart', 'Later']
  }).then((buttonIndex) => {
    if (buttonIndex.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });
});

// Start Angular development server in development mode
function startAngularDevServer() {
  if (process.env.NODE_ENV === 'development') {
    angularProcess = spawn('ng', ['serve'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    angularProcess.on('error', (error) => {
      console.error('Failed to start Angular dev server:', error);
    });

    angularProcess.on('close', (code) => {
      console.log(`Angular dev server process exited with code ${code}`);
    });
  }
}

app.whenReady().then(() => {
  // Start Angular dev server if in development mode
  startAngularDevServer();
  
  createWindow();

  // Check for updates in production mode
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (angularProcess) {
      angularProcess.kill();
    }
    app.quit();
  }
});

// Handle app termination
app.on('before-quit', () => {
  if (angularProcess) {
    angularProcess.kill();
  }
});
import path from 'node:path';

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell
} from 'electron';
import type { OpenDialogOptions } from 'electron';

import {
  DownloadProgressEvent,
  DownloadWorkflowInput,
  DownloadWorkflowResult,
  runDownloadWorkflow,
  suggestProductLabelFromUrl
} from '../../../packages/core/dist';

let mainWindow: BrowserWindow | null = null;

function rendererIndexPath(): string {
  return path.resolve(__dirname, '../../renderer/dist/index.html');
}

function preloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function sendProgress(payload: DownloadProgressEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('downloadProgress', payload);
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 840,
    minHeight: 620,
    title: 'AliImagePull',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devUrl = process.env.RENDERER_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to load renderer dev URL', error);
    });
  } else {
    win.loadFile(rendererIndexPath()).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to load renderer build output', error);
    });
  }

  return win;
}

function validateDownloadInput(payload: unknown): DownloadWorkflowInput {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Request payload is required.');
  }

  const casted = payload as Partial<DownloadWorkflowInput>;

  if (!casted.url || !casted.label || !casted.baseDir) {
    throw new Error('url, label, and baseDir are required.');
  }

  return {
    url: casted.url,
    label: casted.label,
    baseDir: casted.baseDir
  };
}

app.whenReady().then(() => {
  if (process.platform !== 'darwin') {
    dialog.showErrorBox('AliImagePull', 'This app is macOS-only.');
    app.quit();
    return;
  }

  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });

  ipcMain.handle('selectDirectory', async () => {
    const targetWindow = mainWindow ?? BrowserWindow.getFocusedWindow();
    const options: OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory']
    };
    const result = targetWindow
      ? await dialog.showOpenDialog(targetWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return '';
    }

    return result.filePaths[0];
  });

  ipcMain.handle('openFolder', async (_event, folderPath: string) => {
    if (!folderPath) {
      throw new Error('Folder path is required.');
    }

    const errorText = await shell.openPath(folderPath);
    if (errorText) {
      throw new Error(errorText);
    }
  });

  ipcMain.handle('downloadImages', async (_event, payload): Promise<DownloadWorkflowResult> => {
    const input = validateDownloadInput(payload);

    try {
      return await runDownloadWorkflow(input, (progress) => sendProgress(progress));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendProgress({ phase: 'error', message });
      throw new Error(message);
    }
  });

  ipcMain.handle('suggestLabel', async (_event, url: string): Promise<string> => {
    if (!url || typeof url !== 'string') {
      throw new Error('Product URL is required.');
    }

    return suggestProductLabelFromUrl(url);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

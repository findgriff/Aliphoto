import { contextBridge, ipcRenderer } from 'electron';

import type { DownloadProgressEvent, DownloadWorkflowResult } from '../../../packages/core/dist';

contextBridge.exposeInMainWorld('aliImagePull', {
  selectDirectory: (): Promise<string> => ipcRenderer.invoke('selectDirectory'),
  suggestLabel: (url: string): Promise<string> => ipcRenderer.invoke('suggestLabel', url),
  downloadImages: (payload: {
    url: string;
    label: string;
    baseDir: string;
  }): Promise<DownloadWorkflowResult> => ipcRenderer.invoke('downloadImages', payload),
  openFolder: (folderPath: string): Promise<void> => ipcRenderer.invoke('openFolder', folderPath),
  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: DownloadProgressEvent): void => {
      callback(payload);
    };

    ipcRenderer.on('downloadProgress', listener);
    return () => ipcRenderer.removeListener('downloadProgress', listener);
  }
});

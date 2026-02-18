type DownloadPhase = 'extracting' | 'downloading' | 'writing_manifest' | 'done' | 'error';

interface DownloadProgressEvent {
  phase: DownloadPhase;
  message: string;
  foundTotal?: number;
  downloaded?: number;
  totalToDownload?: number;
}

interface DownloadWorkflowResult {
  folderPath: string;
  manifestPath: string;
  imageCount: number;
}

declare global {
  interface Window {
    aliImagePull: {
      selectDirectory: () => Promise<string>;
      suggestLabel: (url: string) => Promise<string>;
      downloadImages: (payload: {
        url: string;
        label: string;
        baseDir: string;
      }) => Promise<DownloadWorkflowResult>;
      openFolder: (folderPath: string) => Promise<void>;
      onDownloadProgress: (callback: (event: DownloadProgressEvent) => void) => () => void;
    };
  }
}

export {};

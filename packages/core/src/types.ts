export type DownloadPhase =
  | 'extracting'
  | 'downloading'
  | 'writing_manifest'
  | 'done'
  | 'error';

export type ImageType = 'main' | 'gallery' | 'description';

export interface DownloadProgressEvent {
  phase: DownloadPhase;
  message: string;
  foundTotal?: number;
  downloaded?: number;
  totalToDownload?: number;
}

export type ProgressCallback = (event: DownloadProgressEvent) => void;

export interface ExtractedImageGroups {
  main: string[];
  gallery: string[];
  description: string[];
}

export interface ImageCandidate {
  type: ImageType;
  order: number;
  url: string;
  globalOrder: number;
}

export interface ManifestImageEntry {
  type: ImageType;
  order: number;
  sourceUrls: string[];
  filename: string;
  sha256: string;
  bytes: number;
  contentType: string;
}

export interface ManifestFile {
  productLabel: string;
  sourceUrl: string;
  downloadedAt: string;
  images: ManifestImageEntry[];
}

export interface DownloadWorkflowInput {
  url: string;
  label: string;
  baseDir: string;
}

export interface DownloadWorkflowResult {
  folderPath: string;
  manifestPath: string;
  imageCount: number;
}

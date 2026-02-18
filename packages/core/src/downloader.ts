import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';

import { fetch } from 'undici';

import {
  DOWNLOAD_CONCURRENCY,
  MAX_IMAGE_BYTES,
  REQUEST_HEADERS,
  REQUEST_TIMEOUT_MS,
  RETRY_DELAYS_MS
} from './constants';
import { ImageCandidate, ManifestImageEntry, ProgressCallback } from './types';
import { assertHttpsUrl } from './validation';

interface DownloadedTempFile {
  candidate: ImageCandidate;
  tempPath: string;
  sha256: string;
  bytes: number;
  contentType: string;
  extension: string;
}

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionFromContentType(contentType: string): string {
  const normalized = (contentType.split(';')[0] ?? '').trim().toLowerCase();
  return CONTENT_TYPE_TO_EXTENSION[normalized] ?? 'jpg';
}

function createFilename(type: ManifestImageEntry['type'], sequence: number, sha256: string, ext: string): string {
  const prefix = String(sequence).padStart(2, '0');
  const typeToken = type === 'description' ? 'desc' : type;
  const hash12 = sha256.slice(0, 12);
  return `${prefix}_${typeToken}_${hash12}.${ext}`;
}

async function streamImageToTemp(
  url: string,
  tempDir: string
): Promise<Omit<DownloadedTempFile, 'candidate'>> {
  assertHttpsUrl(url, 'Discovered image URL');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const tempPath = path.join(tempDir, `${randomUUID()}.tmp`);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...REQUEST_HEADERS,
          accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = ((response.headers.get('content-type') ?? '').split(';')[0] ?? '').trim();
      if (!contentType.toLowerCase().startsWith('image/')) {
        throw new Error(`Invalid Content-Type: ${contentType || 'missing'}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty.');
      }

      const hash = createHash('sha256');
      let bytes = 0;

      const stream = Readable.fromWeb(response.body as never);

      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(tempPath, { flags: 'wx' });

        const onFailure = (error: Error): void => {
          stream.destroy(error);
          writer.destroy();
          reject(error);
        };

        stream.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_IMAGE_BYTES) {
            onFailure(new Error(`File exceeded ${MAX_IMAGE_BYTES} bytes limit.`));
            return;
          }
          hash.update(chunk);
        });

        stream.once('error', (error) => reject(error));
        writer.once('error', (error) => reject(error));
        writer.once('finish', () => resolve());

        stream.pipe(writer);
      });

      return {
        tempPath,
        sha256: hash.digest('hex'),
        bytes,
        contentType,
        extension: extensionFromContentType(contentType)
      };
    } catch (error) {
      lastError = error as Error;
      await fs.rm(tempPath, { force: true });

      if (attempt < RETRY_DELAYS_MS.length) {
        const delayMs = RETRY_DELAYS_MS[attempt];
        if (delayMs !== undefined) {
          await delay(delayMs);
        }
      }
    }
  }

  throw new Error(`Failed after retries: ${lastError?.message ?? 'unknown error'}`);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }

      const item = items[index];
      if (item === undefined) {
        return;
      }

      results[index] = await worker(item, index);
    }
  });

  await Promise.all(workers);
  return results;
}

export interface DownloadOutput {
  images: ManifestImageEntry[];
  failures: string[];
}

export async function downloadImageCandidates(
  folderPath: string,
  candidates: ImageCandidate[],
  onProgress?: ProgressCallback
): Promise<DownloadOutput> {
  const tmpDir = path.join(folderPath, '.tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  let downloaded = 0;

  const attempts = await mapLimit(
    candidates,
    DOWNLOAD_CONCURRENCY,
    async (candidate): Promise<DownloadedTempFile | null> => {
      try {
        const temp = await streamImageToTemp(candidate.url, tmpDir);
        downloaded += 1;
        onProgress?.({
          phase: 'downloading',
          message: `Downloaded ${downloaded}/${candidates.length}`,
          downloaded,
          totalToDownload: candidates.length
        });

        return {
          ...temp,
          candidate
        };
      } catch (error) {
        downloaded += 1;
        onProgress?.({
          phase: 'downloading',
          message: `Failed to download ${candidate.url}: ${(error as Error).message}`,
          downloaded,
          totalToDownload: candidates.length
        });
        return null;
      }
    }
  );

  const failures: string[] = [];
  const success = attempts.filter((entry): entry is DownloadedTempFile => {
    if (!entry) {
      return false;
    }
    return true;
  });

  for (let i = 0; i < attempts.length; i += 1) {
    if (!attempts[i]) {
      const failedCandidate = candidates[i];
      if (failedCandidate) {
        failures.push(failedCandidate.url);
      }
    }
  }

  success.sort((a, b) => a.candidate.globalOrder - b.candidate.globalOrder);

  const images: ManifestImageEntry[] = [];
  const seenBySha = new Map<string, ManifestImageEntry>();
  const seenUrlBySha = new Map<string, Set<string>>();
  let gallerySequence = 2;
  let descriptionSequence = 90;

  for (const file of success) {
    const existing = seenBySha.get(file.sha256);
    if (existing) {
      const urlSet = seenUrlBySha.get(file.sha256) ?? new Set(existing.sourceUrls.map((url) => url.toLowerCase()));
      if (!urlSet.has(file.candidate.url.toLowerCase())) {
        existing.sourceUrls.push(file.candidate.url);
        urlSet.add(file.candidate.url.toLowerCase());
      }
      seenUrlBySha.set(file.sha256, urlSet);
      await fs.rm(file.tempPath, { force: true });
      continue;
    }

    const sequence =
      file.candidate.type === 'main'
        ? 1
        : file.candidate.type === 'gallery'
          ? gallerySequence++
          : descriptionSequence++;

    const filename = createFilename(file.candidate.type, sequence, file.sha256, file.extension);
    const finalPath = path.join(folderPath, filename);
    await fs.rename(file.tempPath, finalPath);

    const entry: ManifestImageEntry = {
      type: file.candidate.type,
      order: file.candidate.order,
      sourceUrls: [file.candidate.url],
      filename,
      sha256: file.sha256,
      bytes: file.bytes,
      contentType: file.contentType
    };

    seenBySha.set(file.sha256, entry);
    seenUrlBySha.set(file.sha256, new Set([file.candidate.url.toLowerCase()]));
    images.push(entry);
  }

  await fs.rm(tmpDir, { recursive: true, force: true });

  return { images, failures };
}

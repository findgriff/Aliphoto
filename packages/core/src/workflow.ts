import { promises as fs } from 'node:fs';
import path from 'node:path';

import { downloadImageCandidates } from './downloader';
import { extractAliExpressImageGroups } from './extractor';
import { sortManifestImagesStable, writeManifestFile, writeProductFile } from './manifest';
import {
  DownloadWorkflowInput,
  DownloadWorkflowResult,
  ImageCandidate,
  ManifestFile,
  ProgressCallback
} from './types';
import { assertHttpsUrl, sanitizeProductLabel } from './validation';

function flattenGroupedUrls(groups: {
  main: string[];
  gallery: string[];
  description: string[];
}): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  let globalOrder = 0;

  groups.main.forEach((url, index) => {
    candidates.push({
      type: 'main',
      order: index + 1,
      url,
      globalOrder: globalOrder++
    });
  });

  groups.gallery.forEach((url, index) => {
    candidates.push({
      type: 'gallery',
      order: index + 1,
      url,
      globalOrder: globalOrder++
    });
  });

  groups.description.forEach((url, index) => {
    candidates.push({
      type: 'description',
      order: index + 1,
      url,
      globalOrder: globalOrder++
    });
  });

  return candidates;
}

export async function runDownloadWorkflow(
  input: DownloadWorkflowInput,
  onProgress?: ProgressCallback
): Promise<DownloadWorkflowResult> {
  const parsedUrl = assertHttpsUrl(input.url, 'Product URL');
  const productLabel = sanitizeProductLabel(input.label);

  const folderPath = path.join(input.baseDir, productLabel);
  await fs.mkdir(folderPath, { recursive: true });

  const groups = await extractAliExpressImageGroups(parsedUrl.toString(), onProgress);
  const candidates = flattenGroupedUrls(groups);

  if (candidates.length === 0) {
    throw new Error('No downloadable image URLs were found.');
  }

  onProgress?.({
    phase: 'downloading',
    message: `Found ${candidates.length} image candidates.`,
    foundTotal: candidates.length,
    downloaded: 0,
    totalToDownload: candidates.length
  });

  const output = await downloadImageCandidates(folderPath, candidates, onProgress);

  if (output.images.length === 0) {
    throw new Error('All image downloads failed.');
  }

  onProgress?.({ phase: 'writing_manifest', message: 'Writing manifest and metadata files.' });

  const manifest: ManifestFile = {
    productLabel,
    sourceUrl: parsedUrl.toString(),
    downloadedAt: new Date().toISOString(),
    images: sortManifestImagesStable(output.images)
  };

  const manifestPath = await writeManifestFile(folderPath, manifest);
  await writeProductFile(folderPath, productLabel, parsedUrl.toString());

  const finalMessage =
    output.failures.length > 0
      ? `Completed with ${output.failures.length} failed URLs.`
      : 'Completed successfully.';

  onProgress?.({
    phase: 'done',
    message: finalMessage,
    foundTotal: candidates.length,
    downloaded: candidates.length,
    totalToDownload: candidates.length
  });

  return {
    folderPath,
    manifestPath,
    imageCount: manifest.images.length
  };
}

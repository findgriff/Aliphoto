import { promises as fs } from 'node:fs';
import path from 'node:path';

import { ManifestFile, ManifestImageEntry } from './types';

export interface MergedSourceRecord {
  sha256: string;
  sourceUrl: string;
}

export function mergeSourceUrlsBySha(records: MergedSourceRecord[]): Map<string, string[]> {
  const merged = new Map<string, string[]>();

  for (const record of records) {
    const current = merged.get(record.sha256) ?? [];
    const exists = current.some((url) => url.toLowerCase() === record.sourceUrl.toLowerCase());
    if (!exists) {
      current.push(record.sourceUrl);
    }
    merged.set(record.sha256, current);
  }

  return merged;
}

export async function writeManifestFile(folderPath: string, manifest: ManifestFile): Promise<string> {
  const filePath = path.join(folderPath, 'manifest.json');
  const json = JSON.stringify(manifest, null, 2) + '\n';
  await fs.writeFile(filePath, json, 'utf8');
  return filePath;
}

export async function writeProductFile(
  folderPath: string,
  productLabel: string,
  sourceUrl: string
): Promise<string> {
  const filePath = path.join(folderPath, 'product.txt');
  const contents = `productLabel=${productLabel}\nsourceUrl=${sourceUrl}\n`;
  await fs.writeFile(filePath, contents, 'utf8');
  return filePath;
}

export function sortManifestImagesStable(images: ManifestImageEntry[]): ManifestImageEntry[] {
  const rank: Record<ManifestImageEntry['type'], number> = {
    main: 0,
    gallery: 1,
    description: 2
  };

  return [...images].sort((a, b) => {
    if (a.type !== b.type) {
      return rank[a.type] - rank[b.type];
    }

    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.filename.localeCompare(b.filename);
  });
}

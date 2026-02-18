import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { writeManifestFile } from '../src/manifest';
import { ManifestFile } from '../src/types';

describe('manifest writing', () => {
  it('writes stable JSON output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aliimagepull-'));

    try {
      const manifest: ManifestFile = {
        productLabel: 'example_001',
        sourceUrl: 'https://www.aliexpress.com/item/123.html',
        downloadedAt: '2026-01-01T00:00:00.000Z',
        images: [
          {
            type: 'main',
            order: 1,
            sourceUrls: ['https://img.example.com/a.jpg'],
            filename: '01_main_abc123def456.jpg',
            sha256: 'abc123def4567890',
            bytes: 1234,
            contentType: 'image/jpeg'
          }
        ]
      };

      const filePath = await writeManifestFile(dir, manifest);
      const content = await readFile(filePath, 'utf8');

      expect(content).toBe(
        '{\n' +
          '  "productLabel": "example_001",\n' +
          '  "sourceUrl": "https://www.aliexpress.com/item/123.html",\n' +
          '  "downloadedAt": "2026-01-01T00:00:00.000Z",\n' +
          '  "images": [\n' +
          '    {\n' +
          '      "type": "main",\n' +
          '      "order": 1,\n' +
          '      "sourceUrls": [\n' +
          '        "https://img.example.com/a.jpg"\n' +
          '      ],\n' +
          '      "filename": "01_main_abc123def456.jpg",\n' +
          '      "sha256": "abc123def4567890",\n' +
          '      "bytes": 1234,\n' +
          '      "contentType": "image/jpeg"\n' +
          '    }\n' +
          '  ]\n' +
          '}\n'
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

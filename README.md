# AliImagePull

AliImagePull is a macOS-only Electron desktop app (TypeScript, strict mode) that:
- accepts an AliExpress product URL + required product label
- can generate a valid product label from the AliExpress page title
- extracts product image candidates (main/gallery/description)
- downloads image files over HTTPS with retries, timeout, size/type validation
- writes deterministic filenames and `manifest.json` for downstream automation

## Tech/versions
- `electron@40.4.1`
- `playwright@1.58.2`
- `undici@7.22.0`

## Prerequisites
- macOS
- Node.js 20+
- npm

## Install
```bash
npm install
npx playwright install --with-deps
```

## Run (dev)
```bash
npm run dev
```

If Electron does not open and your shell exports `ELECTRON_RUN_AS_NODE=1`, run:
```bash
unset ELECTRON_RUN_AS_NODE
npm run dev
```

## Build
```bash
npm run build
```

## Package `.dmg`
```bash
npm run package
```
Output goes to `release/`.

## Set macOS app icon
1. Put your icon image on disk (recommended 1024x1024 PNG).
2. Generate `.icns`:
```bash
npm run icon:mac -- /absolute/path/to/icon.png
```
3. Rebuild package:
```bash
npm run package
```

## Workspace layout
- `apps/electron-main`: Electron main + preload
- `apps/renderer`: Vite + React renderer UI
- `packages/core`: extractor/downloader/manifest/validation logic

## Output format
For inputs:
- `baseDir=/Users/me/Downloads/ali`
- `productLabel=example_001`

AliImagePull writes:
```
/Users/me/Downloads/ali/example_001/
  01_main_abc123def456.jpg
  02_gallery_ffeeddccbbaa.webp
  03_gallery_998877665544.jpg
  90_desc_112233445566.png
  manifest.json
  product.txt
```

Deterministic file naming:
- `01_main_<hash12>.<ext>`
- `02_gallery_<hash12>.<ext>` (gallery increments: `03_...`, `04_...`)
- `90_desc_<hash12>.<ext>` (description increments: `91_...`, `92_...`)

Where:
- `<hash12>` = first 12 chars of SHA-256 of file bytes
- extension from Content-Type (`image/jpeg -> jpg`, `image/png -> png`, `image/webp -> webp`, default `jpg`)

`manifest.json` schema:
```json
{
  "productLabel": "example_001",
  "sourceUrl": "https://www.aliexpress.com/item/....html",
  "downloadedAt": "ISO-8601 UTC",
  "images": [
    {
      "type": "main|gallery|description",
      "order": 1,
      "sourceUrls": ["https://..."],
      "filename": "01_main_abc123def456.jpg",
      "sha256": "<full sha256 hex>",
      "bytes": 123456,
      "contentType": "image/jpeg"
    }
  ]
}
```

Dedup behavior:
- dedupe by `sha256`
- duplicate files are not re-saved
- duplicate source URLs are merged into the matched `images[].sourceUrls`

## Security and reliability notes
- rejects non-HTTPS product URL
- downloads only extractor-discovered URLs (not arbitrary user image URLs)
- validates/sanitizes `productLabel` (`[A-Za-z0-9_-]`, max 64)
- concurrency cap: 4
- timeout: 20s per request
- max image size: 20 MB
- retries with backoff: 250ms, 1s, 4s
- temp file then atomic rename

## Test
```bash
npm test
```
Includes unit tests for:
- label validation/sanitization
- URL normalization
- dedup source URL merging
- stable manifest writing

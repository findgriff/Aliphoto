export const MAX_LABEL_LENGTH = 64;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 20_000;
export const DOWNLOAD_CONCURRENCY = 4;
export const RETRY_DELAYS_MS = [250, 1000, 4000] as const;

export const REQUEST_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  pragma: 'no-cache',
  'cache-control': 'no-cache'
};

export const IMAGE_KEY_HINTS = new Set([
  'imagepathlist',
  'imagemodule',
  'skumodule',
  'description',
  'detaildesc',
  'image',
  'images'
]);

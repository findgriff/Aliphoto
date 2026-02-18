import { load } from 'cheerio';
import { fetch } from 'undici';

import { MAX_LABEL_LENGTH, REQUEST_HEADERS, REQUEST_TIMEOUT_MS } from './constants';
import { assertHttpsUrl, validateProductLabel } from './validation';

function normalizeToLabel(text: string): string {
  const normalized = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return normalized.slice(0, MAX_LABEL_LENGTH);
}

function fallbackLabelFromUrl(url: URL): string {
  const itemMatch = url.pathname.match(/item\/(\d+)\.html/i);
  if (itemMatch && itemMatch[1]) {
    return `item_${itemMatch[1]}`.slice(0, MAX_LABEL_LENGTH);
  }

  const cleanedPath = normalizeToLabel(url.pathname);
  if (cleanedPath) {
    return cleanedPath.slice(0, MAX_LABEL_LENGTH);
  }

  return 'aliexpress_item';
}

export async function suggestProductLabelFromUrl(productUrl: string): Promise<string> {
  const parsed = assertHttpsUrl(productUrl, 'Product URL');
  if (!parsed.hostname.toLowerCase().includes('aliexpress')) {
    throw new Error('Product URL must be an AliExpress URL.');
  }

  const response = await fetch(parsed.toString(), {
    method: 'GET',
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch product page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);

  const candidates = [
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('title').first().text()
  ];

  let label = '';
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeToLabel(candidate);
    if (!normalized) {
      continue;
    }

    label = normalized;
    break;
  }

  if (!label) {
    label = fallbackLabelFromUrl(parsed);
  }

  try {
    return validateProductLabel(label);
  } catch {
    return validateProductLabel(fallbackLabelFromUrl(parsed));
  }
}

export function titleToLabel(title: string): string {
  const label = normalizeToLabel(title);
  if (!label) {
    throw new Error('Unable to generate label from title.');
  }

  return validateProductLabel(label);
}

const IMAGE_EXTENSION_REGEX = /\.(jpg|jpeg|png|webp|gif|avif|bmp)(?:$|[?#])/i;

export function normalizeImageUrl(rawUrl: string): string | null {
  const cleaned = rawUrl
    .trim()
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&');

  if (!cleaned) {
    return null;
  }

  let candidate = cleaned;
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  }

  if (candidate.startsWith('http://')) {
    candidate = `https://${candidate.slice('http://'.length)}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  parsed.hash = '';
  return parsed.toString();
}

export function isPlausibleImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  const lowerHost = parsed.hostname.toLowerCase();
  const lowerPath = parsed.pathname.toLowerCase();
  const lowerQuery = parsed.search.toLowerCase();

  if (IMAGE_EXTENSION_REGEX.test(lowerPath)) {
    return true;
  }

  if (
    (lowerHost.includes('alicdn') || lowerHost.includes('aliexpress')) &&
    (lowerPath.includes('image') || lowerPath.includes('img') || lowerQuery.includes('format='))
  ) {
    return true;
  }

  return false;
}

export function normalizeAndDedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of urls) {
    const normalized = normalizeImageUrl(raw);
    if (!normalized || !isPlausibleImageUrl(normalized)) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(normalized);
  }

  return out;
}

export function extractUrlsFromText(text: string): string[] {
  const unescaped = text.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const matches = unescaped.match(/(https?:\/\/[^\s"'<>\\]+|\/\/[^\s"'<>\\]+)/gi);

  if (!matches) {
    return [];
  }

  return matches.map((value) => value.replace(/[\]),;]+$/, ''));
}

export function parseSrcSet(srcset: string): string[] {
  return srcset
    .split(',')
    .map((chunk) => chunk.trim().split(/\s+/)[0])
    .filter((value): value is string => Boolean(value));
}

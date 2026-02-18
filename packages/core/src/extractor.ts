import { load } from 'cheerio';
import { chromium } from 'playwright';
import { fetch } from 'undici';

import { IMAGE_KEY_HINTS, REQUEST_HEADERS, REQUEST_TIMEOUT_MS } from './constants';
import { ExtractedImageGroups, ProgressCallback } from './types';
import { extractUrlsFromText, normalizeAndDedupeUrls, parseSrcSet } from './url';
import { assertHttpsUrl } from './validation';

interface StaticExtractionResult {
  urls: string[];
  scriptUrls: string[];
  html: string;
}

function shouldUseDynamicFallback(staticUrls: string[], html: string): boolean {
  if (staticUrls.length < 3) {
    return true;
  }

  const scriptTagCount = (html.match(/<script\b/gi) ?? []).length;
  const imageTagCount = (html.match(/<img\b/gi) ?? []).length;

  return scriptTagCount > 25 && imageTagCount < 4;
}

function includesImageHint(text: string): boolean {
  const lower = text.toLowerCase();
  for (const hint of IMAGE_KEY_HINTS) {
    if (lower.includes(hint)) {
      return true;
    }
  }
  return false;
}

function classifyImages(urls: string[]): ExtractedImageGroups {
  const description: string[] = [];
  const nonDescription: string[] = [];

  for (const url of urls) {
    const lower = url.toLowerCase();
    if (lower.includes('desc') || lower.includes('description') || lower.includes('detail')) {
      description.push(url);
    } else {
      nonDescription.push(url);
    }
  }

  const firstMain = nonDescription.at(0);
  const main = firstMain ? [firstMain] : [];
  const gallery = nonDescription.slice(1);

  return {
    main,
    gallery,
    description
  };
}

async function fetchStaticHtml(url: string): Promise<StaticExtractionResult> {
  const response = await fetch(url, {
    method: 'GET',
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch product page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);

  const collected: string[] = [];
  const scriptUrls: string[] = [];

  const pushCandidate = (value: string | null | undefined): void => {
    if (!value) {
      return;
    }
    collected.push(value);
  };

  pushCandidate($('meta[property="og:image"]').attr('content'));

  $('img').each((_, element) => {
    pushCandidate($(element).attr('src'));
    pushCandidate($(element).attr('data-src'));
    const srcset = $(element).attr('srcset');
    if (srcset) {
      for (const parsed of parseSrcSet(srcset)) {
        pushCandidate(parsed);
      }
    }
  });

  $('source').each((_, element) => {
    const srcset = $(element).attr('srcset');
    if (srcset) {
      for (const parsed of parseSrcSet(srcset)) {
        pushCandidate(parsed);
      }
    }
  });

  $('script').each((_, element) => {
    const content = $(element).text();
    if (!content) {
      return;
    }

    for (const urlCandidate of extractUrlsFromText(content)) {
      scriptUrls.push(urlCandidate);
      if (includesImageHint(content)) {
        collected.push(urlCandidate);
      }
    }

    const scriptType = ($(element).attr('type') || '').toLowerCase();
    if (scriptType.includes('application/ld+json')) {
      try {
        const json = JSON.parse(content) as unknown;
        const stack: unknown[] = [json];
        while (stack.length > 0) {
          const current = stack.pop();
          if (!current) {
            continue;
          }

          if (typeof current === 'string') {
            collected.push(current);
            continue;
          }

          if (Array.isArray(current)) {
            stack.push(...current);
            continue;
          }

          if (typeof current === 'object') {
            for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
              if (typeof value === 'string' && IMAGE_KEY_HINTS.has(key.toLowerCase())) {
                collected.push(value);
              }
              stack.push(value);
            }
          }
        }
      } catch {
        // Non-critical: keep extracting via heuristic URL scan.
      }
    }
  });

  return {
    urls: normalizeAndDedupeUrls(collected),
    scriptUrls: normalizeAndDedupeUrls(scriptUrls),
    html
  };
}

async function fetchDynamicUrls(url: string): Promise<string[]> {
  const browser = await chromium.launch({ headless: true });

  try {
    const userAgent = REQUEST_HEADERS['user-agent'] ?? 'Mozilla/5.0';
    const page = await browser.newPage({
      userAgent
    });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 45_000
    });

    const payload = await page.evaluate(() => {
      const discovered: string[] = [];
      const scripts: string[] = [];

      const push = (value: string | null | undefined): void => {
        if (value && value.trim().length > 0) {
          discovered.push(value);
        }
      };

      document.querySelectorAll('img').forEach((image) => {
        const htmlImage = image as HTMLImageElement;
        push(htmlImage.currentSrc);
        push(htmlImage.src);
        push(htmlImage.getAttribute('data-src'));
        push(htmlImage.getAttribute('data-lazy-src'));
        const srcset = htmlImage.getAttribute('srcset');
        if (srcset) {
          srcset.split(',').forEach((entry) => {
            push(entry.trim().split(/\s+/)[0]);
          });
        }
      });

      document.querySelectorAll('source').forEach((sourceNode) => {
        const srcset = sourceNode.getAttribute('srcset');
        if (srcset) {
          srcset.split(',').forEach((entry) => {
            push(entry.trim().split(/\s+/)[0]);
          });
        }
      });

      document.querySelectorAll('script').forEach((scriptNode) => {
        scripts.push(scriptNode.textContent ?? '');
      });

      return {
        discovered,
        scripts,
        html: document.documentElement.outerHTML
      };
    });

    const scriptUrls = payload.scripts.flatMap((text) => extractUrlsFromText(text));
    const htmlUrls = extractUrlsFromText(payload.html);

    return normalizeAndDedupeUrls([...payload.discovered, ...scriptUrls, ...htmlUrls]);
  } finally {
    await browser.close();
  }
}

export async function extractAliExpressImageGroups(
  productUrl: string,
  onProgress?: ProgressCallback
): Promise<ExtractedImageGroups> {
  const parsed = assertHttpsUrl(productUrl, 'Product URL');
  if (!parsed.hostname.toLowerCase().includes('aliexpress')) {
    throw new Error('Product URL must be an AliExpress URL.');
  }

  onProgress?.({ phase: 'extracting', message: 'Fetching product page and parsing static content.' });

  const staticResult = await fetchStaticHtml(parsed.toString());
  let allUrls = staticResult.urls;

  if (shouldUseDynamicFallback(staticResult.urls, staticResult.html)) {
    onProgress?.({
      phase: 'extracting',
      message: 'Static extraction was sparse; running Playwright dynamic fallback.'
    });

    const dynamicUrls = await fetchDynamicUrls(parsed.toString());
    allUrls = normalizeAndDedupeUrls([...allUrls, ...dynamicUrls, ...staticResult.scriptUrls]);
  }

  const grouped = classifyImages(allUrls);

  if (grouped.main.length + grouped.gallery.length + grouped.description.length === 0) {
    throw new Error('No image URLs were discovered on the product page.');
  }

  return grouped;
}

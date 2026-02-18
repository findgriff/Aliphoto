import { MAX_LABEL_LENGTH } from './constants';

const PRODUCT_LABEL_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export function validateProductLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Product Label is required.');
  }

  if (trimmed.length > MAX_LABEL_LENGTH) {
    throw new Error(`Product Label must be at most ${MAX_LABEL_LENGTH} characters.`);
  }

  if (!PRODUCT_LABEL_REGEX.test(trimmed)) {
    throw new Error('Product Label may contain only letters, numbers, underscore, and hyphen.');
  }

  return trimmed;
}

export function sanitizeProductLabel(label: string): string {
  const validated = validateProductLabel(label);

  if (validated.includes('/') || validated.includes('\\') || validated.includes('..')) {
    throw new Error('Product Label contains invalid path characters.');
  }

  return validated;
}

export function assertHttpsUrl(rawUrl: string, fieldName: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${fieldName} is not a valid URL.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} must use HTTPS.`);
  }

  return parsed;
}

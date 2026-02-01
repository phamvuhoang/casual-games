export function sanitizeRedirect(value?: string | null, fallback = '/discover') {
  if (!value) {
    return fallback;
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  return fallback;
}

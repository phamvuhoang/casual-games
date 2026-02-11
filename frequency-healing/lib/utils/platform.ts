export function isIOSDevice() {
  if (typeof window === 'undefined') {
    return false;
  }

  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const maxTouchPoints = window.navigator.maxTouchPoints ?? 0;
  const isiOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = platform === 'MacIntel' && maxTouchPoints > 1;

  return isiOS || isIPadOS;
}

export function isAndroidDevice() {
  if (typeof window === 'undefined') {
    return false;
  }

  return /Android/i.test(window.navigator.userAgent);
}

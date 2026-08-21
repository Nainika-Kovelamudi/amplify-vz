/** YouTube watch / short / embed URLs → iframe embed src, or null. */
export function parseYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

/** Treat URL as an image demo when it is not YouTube and the path ends with a common raster/vector extension. */
export function isLikelyImageDemoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || parseYoutubeEmbedUrl(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    const last = u.pathname.split('/').pop() ?? '';
    const base = last.split(/[?#]/)[0];
    return /\.(jpe?g|png|gif|webp|avif|svg|bmp|heic|heif)$/i.test(base);
  } catch {
    return false;
  }
}

export type DemoMediaPresentationKind = 'youtube' | 'image' | 'video';

export function getDemoMediaPresentationKind(url: string): DemoMediaPresentationKind {
  if (parseYoutubeEmbedUrl(url)) return 'youtube';
  if (isLikelyImageDemoUrl(url)) return 'image';
  return 'video';
}

export type WatchDemoSources = {
  videoUrl?: string | null;
  demoUrl?: string | null;
  govNotes?: string | null;
  attachments?: { url?: string; type?: string }[] | null;
};

function normalizeHttpUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed || /^not applicable$/i.test(trimmed)) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return undefined;
}

/** True when a URL is suitable for the in-app Watch demo player (not a generic hosted web app). */
export function isPlayableWatchDemoUrl(url: string): boolean {
  const normalized = normalizeHttpUrl(url);
  if (!normalized) return false;
  if (parseYoutubeEmbedUrl(normalized)) return true;
  if (isLikelyImageDemoUrl(normalized)) return true;

  try {
    const pathname = new URL(normalized).pathname.toLowerCase();
    if (/\.(mp4|webm|mov|m4v|ogv|mkv|m3u8)(\?|$)/i.test(pathname)) return true;
    if (pathname.includes('/demo-videos/')) return true;
  } catch {
    return false;
  }

  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (host.includes('firebasestorage.googleapis.com')) return true;
    if (host.includes('storage.googleapis.com')) return true;
  } catch {
    return false;
  }

  return false;
}

export function extractWatchDemoUrlFromGovNotes(govNotes?: string | null): string | undefined {
  if (!govNotes?.trim()) return undefined;

  const videoFileLine = govNotes.split('\n').find((line) => /^Video file:/i.test(line));
  if (videoFileLine) {
    const value = videoFileLine.replace(/^Video file:\s*/i, '').trim();
    if (value && !/^not available$/i.test(value)) {
      const normalized = normalizeHttpUrl(value);
      if (normalized && (isPlayableWatchDemoUrl(normalized) || /^https?:\/\//i.test(value))) {
        return normalized;
      }
    }
  }

  const urls = govNotes.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const raw of urls) {
    const cleaned = raw.replace(/[),.;]+$/, '');
    if (isPlayableWatchDemoUrl(cleaned)) return normalizeHttpUrl(cleaned);
  }

  return undefined;
}

/** Resolve the URL used by Watch demo from DB columns and pipeline metadata. */
export function resolveWatchDemoUrl(sources: WatchDemoSources): string | undefined {
  // Trust explicit `video_url` / `submissions.video_url` values (Firebase, YouTube, MP4, etc.).
  const directVideo = sources.videoUrl?.trim();
  if (directVideo && !/^not available$/i.test(directVideo)) {
    const normalized = normalizeHttpUrl(directVideo);
    if (normalized) return normalized;
  }

  const fromNotes = extractWatchDemoUrlFromGovNotes(sources.govNotes);
  if (fromNotes) return fromNotes;

  for (const attachment of sources.attachments ?? []) {
    const url = attachment.url?.trim();
    if (url && isPlayableWatchDemoUrl(url)) return normalizeHttpUrl(url);
  }

  const demo = sources.demoUrl?.trim();
  if (demo && isPlayableWatchDemoUrl(demo)) return normalizeHttpUrl(demo);

  return undefined;
}

import { apiClient } from './apiClient';
import { authStore } from '../store/authStore';

export type MediaType = 'image' | 'video' | 'thumbnail' | 'document';

export interface UploadResult {
  url: string;
  blob_path: string;
}

interface DirectUploadResult extends UploadResult {
  upload_url: string;
}

function putBlobPart(
  url: string,
  body: Blob | string,
  contentType: string,
  onProgress?: (loaded: number) => void,
  headers?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    Object.entries(headers ?? {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.timeout = 180_000;
    xhr.upload.onprogress = event => onProgress?.(event.loaded);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Storage upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error('Direct storage upload failed. Check Blob CORS and network access.'));
    xhr.ontimeout = () => reject(new Error('A video block timed out.'));
    xhr.send(body);
  });
}

async function uploadVideoInBlocks(file: File, uploadUrl: string, onProgress?: (percent: number) => void): Promise<void> {
  // Larger blocks and four workers substantially reduce request overhead while
  // remaining conservative enough for corporate networks and large videos.
  const blockSize = file.size >= 512 * 1024 * 1024
    ? 16 * 1024 * 1024
    : 8 * 1024 * 1024;
  const concurrency = 4;
  const blockCount = Math.ceil(file.size / blockSize);
  const blockIds = Array.from({ length: blockCount }, (_, index) => btoa(index.toString().padStart(8, '0')));
  const loadedByBlock = new Array<number>(blockCount).fill(0);
  let nextIndex = 0;
  const updateProgress = (index: number, loaded: number) => {
    loadedByBlock[index] = loaded;
    const totalLoaded = loadedByBlock.reduce((sum, value) => sum + value, 0);
    onProgress?.(Math.min(99, Math.round((totalLoaded * 100) / file.size)));
  };
  const worker = async () => {
    while (nextIndex < blockCount) {
      const index = nextIndex++;
      const offset = index * blockSize;
      const block = file.slice(offset, Math.min(offset + blockSize, file.size));
      const blockUrl = `${uploadUrl}&comp=block&blockid=${encodeURIComponent(blockIds[index])}`;
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          updateProgress(index, 0);
          await putBlobPart(blockUrl, block, 'application/octet-stream', loaded => updateProgress(index, loaded));
          updateProgress(index, block.size);
          lastError = null;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Video block upload failed.');
          if (attempt < 3) {
            await new Promise(resolve => window.setTimeout(resolve, 500 * (2 ** (attempt - 1))));
          }
        }
      }
      if (lastError) throw lastError;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, blockCount) }, () => worker()));
  const blockList = `<?xml version="1.0" encoding="utf-8"?><BlockList>${blockIds.map(id => `<Latest>${id}</Latest>`).join('')}</BlockList>`;
  await putBlobPart(
    `${uploadUrl}&comp=blocklist`,
    blockList,
    'application/xml',
    undefined,
    { 'x-ms-blob-content-type': file.type || 'video/mp4' },
  );
  onProgress?.(100);
}

export async function uploadMedia(
  file: File,
  mediaType: MediaType = 'image',
  onProgress?: (percent: number) => void,
  entityId?: string,
  family?: string,
): Promise<UploadResult> {
  // Send file as raw binary body — no multipart parsing on the backend.
  // Metadata travels as query params; filename as X-Filename header.
  // This bypasses Starlette's multipart size limit entirely.
  const params = new URLSearchParams({ media_type: mediaType });
  if (entityId) params.set('entity_id', entityId);
  if (family) params.set('family', family);

  const baseURL = (apiClient.defaults.baseURL as string) || '';
  const token = authStore.getState().accessToken;
  const isVideo = mediaType === 'video';
  const timeout = isVideo ? 10 * 60 * 1000 : 60 * 1000;

  if (isVideo) {
    if (file.size > 800 * 1024 * 1024) throw new Error('Video exceeds the 800 MB limit.');
    const { data: target } = await apiClient.post<DirectUploadResult>('/media/upload-url', null, {
      params: { filename: file.name, content_type: file.type || 'application/octet-stream', media_type: mediaType, entity_id: entityId, family },
    });
    await uploadVideoInBlocks(file, target.upload_url, onProgress);
    return { url: target.url, blob_path: target.blob_path };
  }

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseURL}/media/upload?${params}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    xhr.timeout = timeout;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((100 * e.loaded) / e.total));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid response from server')); }
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body?.detail || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(file);  // raw File object, not FormData
  });
}

export async function deleteMedia(blobPath: string): Promise<void> {
  await apiClient.delete(`/media/${blobPath}`);
}

export function isAmplifyBlobUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.blob.core.windows.net');
}

export function blobPathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // path is /{container}/{blob_name...} — strip leading slash
    return u.pathname.slice(1);
  } catch {
    return null;
  }
}

export async function deleteMediaByUrl(url: string | null | undefined): Promise<void> {
  if (!url || !isAmplifyBlobUrl(url)) return;
  const path = blobPathFromUrl(url);
  if (path) await deleteMedia(path);
}

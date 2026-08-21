import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseConfigured } from './firebase';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function safeFileName(name: string) {
  const base = name.replace(/[^\w.\-]+/g, '_').slice(0, 180);
  return base || 'demo.bin';
}

function validateDemoMediaFile(file: File) {
  if (file.type.startsWith('video/')) {
    return;
  }
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Image must be 25 MB or smaller.');
    }
    return;
  }
  throw new Error('Please choose a video (MP4, WebM, …) or an image (PNG, JPG, WebP, …).');
}

/**
 * Upload a demo video or image to Firebase Storage under `demo-videos/` and return a download URL
 * (stored in `video_url` / `videoUrl` alongside hosted video links).
 */
export async function uploadDemoMedia(file: File, onProgress?: (percent: number) => void): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }
  validateDemoMediaFile(file);

  const storage = getFirebaseStorage();
  const path = `demo-videos/${crypto.randomUUID()}_${safeFileName(file.name)}`;
  const storageRef = ref(storage, path);
  const metadata = { contentType: file.type };

  const task = uploadBytesResumable(storageRef, file, metadata);

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const pct = snapshot.totalBytes ? Math.round((100 * snapshot.bytesTransferred) / snapshot.totalBytes) : 0;
        onProgress?.(pct);
      },
      (err) => reject(err),
      () => resolve(),
    );
  });

  return getDownloadURL(task.snapshot.ref);
}

import { deleteObject, ref } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseConfigured } from './firebase';

/** Firebase download URLs served from Storage (legacy and newer hostnames). */
export function isFirebaseStorageDownloadUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('firebasestorage.googleapis.com') || u.includes('.firebasestorage.app');
}

/** Best-effort delete of the Storage object behind a download URL. Ignores non-Firebase URLs and failures (already deleted, etc.). */
export async function deleteFirebaseObjectAtUrlIfOurs(url: string | null | undefined): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed || !isFirebaseConfigured() || !isFirebaseStorageDownloadUrl(trimmed)) return;
  try {
    const storage = getFirebaseStorage();
    const fileRef = ref(storage, trimmed);
    await deleteObject(fileRef);
  } catch {
    // Object missing (DELETE 404 in DevTools is normal), rules, or network — do not block DB delete/update.
  }
}

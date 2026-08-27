import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { uploadMedia } from '../../lib/mediaService';

type DemoVideoDropzoneProps = {
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  disabled?: boolean;
  entityId?: string;
  family?: string;
};

function demoReadyLabel(url: string): string {
  return url.trim() ? 'Video demo ready' : 'Demo video';
}

export function DemoVideoDropzone({ videoUrl, onVideoUrlChange, disabled, entityId, family }: DemoVideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const hasMedia = Boolean(videoUrl.trim());

  const runUpload = useCallback(async (file: File | undefined) => {
    if (!file || disabled || hasMedia) return;
    setError('');
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file. Images are not supported for demo uploads.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const { url } = await uploadMedia(file, 'video', setProgress, entityId, family);
      onVideoUrlChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [disabled, entityId, family, hasMedia, onVideoUrlChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (hasMedia) return;
    void runUpload(e.dataTransfer.files?.[0]);
  }, [hasMedia, runUpload]);

  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasMedia) return;
    void runUpload(e.target.files?.[0]);
    e.target.value = '';
  };

  const readyRow = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
      <span className="font-bold">{demoReadyLabel(videoUrl)}:</span>
      <span className="max-w-[min(100%,28rem)] truncate font-mono text-emerald-800">{videoUrl}</span>
      <button type="button" disabled={disabled || uploading} onClick={() => onVideoUrlChange('')}
        className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
        <X className="h-3 w-3" /> Remove
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {!hasMedia && (
        <div
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`relative flex min-h-[168px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition ${
            disabled || uploading ? 'cursor-default border-gray-200 bg-gray-50 opacity-70'
            : isDragging ? 'border-sky-500 bg-sky-50'
            : 'border-gray-300 bg-gray-50/50 hover:border-sky-400 hover:bg-sky-50/40'}`}
        >
          <input ref={inputRef} type="file" accept="video/*" className="hidden" disabled={disabled || uploading} onChange={onBrowse} />
          {uploading ? (
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 text-sky-700">
              <Loader2 className="h-10 w-10 shrink-0 animate-spin" />
              <span className="text-sm font-bold">Uploading… {progress}%</span>
              <div className="h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-sky-100">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 text-center text-gray-600">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
                <Upload className="h-6 w-6 text-sky-500" />
              </div>
              <div className="text-sm font-bold text-gray-900">Upload demo video</div>
              <div className="max-w-md text-xs leading-relaxed text-gray-500">Video up to 800 MB · drag & drop or browse</div>
              <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}
                className="mt-1 shrink-0 rounded-lg border border-sky-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-sky-700 shadow-sm transition hover:border-sky-400 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">
                Browse files
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      {hasMedia && readyRow}

    </div>
  );
}

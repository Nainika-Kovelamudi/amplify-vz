import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getDemoMediaPresentationKind, parseYoutubeEmbedUrl } from '../../lib/demoMediaUrl';

type DemoVideoModalProps = {
  open: boolean;
  url: string;
  title?: string;
  onClose: () => void;
};

export function DemoVideoModal({ open, url, title, onClose }: DemoVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !url.trim()) return null;

  const youtubeEmbed = parseYoutubeEmbedUrl(url);
  const kind = getDemoMediaPresentationKind(url);
  const heading = title ?? (kind === 'image' ? 'Demo image' : 'Demo video');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={kind === 'image' ? 'Demo image' : 'Demo video'}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0 truncate text-sm font-bold text-white">{heading}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-black p-2 sm:p-4">
          {youtubeEmbed ? (
            <div className="aspect-video w-full min-h-[min(50vw,360px)] overflow-hidden rounded-lg bg-neutral-950">
              <iframe
                title="Demo video"
                src={youtubeEmbed}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : kind === 'image' ? (
            <div className="flex max-h-[min(85vh,720px)] min-h-[min(50vw,280px)] w-full items-center justify-center overflow-auto rounded-lg bg-neutral-950 p-2">
              <img
                src={url}
                alt={title ? `Demo image: ${title}` : 'Demo image'}
                className="max-h-[min(85vh,680px)] w-auto max-w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <div className="relative aspect-video w-full min-h-[min(50vw,280px)] max-h-[min(85vh,720px)] overflow-hidden rounded-lg bg-neutral-950">
              <video
                ref={videoRef}
                key={url}
                src={url}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

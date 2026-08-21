import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styling for destructive actions (e.g. delete). */
  variant?: 'danger' | 'default';
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isPending = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isPending, onClose]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
      onClick={isPending ? undefined : onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 bg-gradient-to-br from-rose-50/90 via-white to-slate-50/80 px-6 pb-5 pt-6">
          <div className="flex gap-4">
            {isDanger && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-100 text-rose-600 shadow-sm">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 id="confirm-dialog-title" className="text-lg font-bold tracking-tight text-gray-900">
                {title}
              </h2>
              <p id="confirm-dialog-desc" className="mt-2 text-sm leading-relaxed text-gray-600">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/80 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose} className="w-full sm:w-auto">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isPending}
            onClick={onConfirm}
            className={
              isDanger
                ? 'w-full border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-700 sm:w-auto'
                : 'w-full sm:w-auto'
            }
          >
            {isPending ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
